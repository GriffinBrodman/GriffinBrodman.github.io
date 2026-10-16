/* Fight effects: shaped pixel-particle skill animations, the impact kit, floor decals, area rings and synthesised sound. */
/*
  FightFX draws in stage pixels onto a 2D context the replay owns (the S stage: 384x216 native, side view, ground plane
  flattened by FLAT = 0.32). Every effect is a pure function of time: the same (family, params, from, to, t) always draws
  the same pixels, so the engine may slow, freeze (hit-stop), scrub or skip with no state to keep. Nothing here reads LD.

  POINTS   p = {x, y, h}: x, y are a fighter's feet on the ground in stage px; h is the sprite height (default 30).
           FightFX.chest(p) -> {x, y}: where blows and spells land. `to` is one point or an array of points (cleave, aoe,
           multi, chain, heal_all, buff_all, debuff_all); self effects pass to = from (or omit it).
  FAMILIES slash thrust smash arrow bolt beam nova heal buff summon curse guard. FightFX.FAMILIES[f] =
           {shapes: [...], about}; the first shape is the default.
           slash  arc cross wide flurry claw bite          melee cuts: a crescent smear at the target
           thrust stab rapier pierce lance                  a streak through the target (pierce runs through every target)
           smash  hammer stomp slam quake jaws deadfall      overhead blows: crack decal, shockwave, dust; jaws = a tossed trap
                                                             snaps shut on the shins, deadfall = a log drops on the foes
           arrow  arrow volley bolt sling throw              physical missiles; volley lobs `count` of them
           bolt   missile lance lob strike drain swarm       shaped spell projectiles (never balls); the school is the material
           beam   ray pillar breath chain                    sustained: a ray, a column from the sky, a cone, a hopping chain
           nova   burst rain eruption storm cloud            area spells; a floor ring marks the area
           heal   motes glyph wave regen                     rising motes, a floor glyph, a wave over allies, leafy regrowth
           buff   aura chevrons shout vanish rage path       self/ally boosts; shout = rally, vanish = stealth, rage = fury,
                  decoy anthem                               path = a trail of glowing hoofprints runs out to each ally,
                                                             decoy = `count` copies of the hero split off (mirror images),
                                                             anthem = a stave of light carries notes out to each ally
           summon circle rise call puff                      the newcomer arrives at `to` (its target pose ramps it in)
           curse  hex dread cloud mark bind lure             debuffs and fear: sigils, a dread pulse, a cloud, a reticle, binds;
                  strings swirl phantasm mirrors snare       lure = a glamour on the water draws foes in, weed coils them;
                                                             strings = a puppet bar on threads (charm), swirl = a dizzy spiral,
                                                             phantasm = a horror rises behind the foe (count 1 = horned),
                                                             mirrors = panes round the foe flash and shatter, snare = a loop
                                                             on the ground jerks tight round the ankles
           guard  shield wall dome parry                     a plate, a wall, a bubble or a parry flash in front of `from`
  SCHOOLS  palette + material (particle shapes, decal, sound timbre). FightFX.SCHOOLS[id] = {pal, particle, decal, sound}:
           blade shield fury command flame frost storm arcane lore holy healing shadow death wild beast marksman road
           riding trade song hearth craft illusion, plus physical poison water bone. Aliases: fire ice lightning nature light
           rage dark necro venom acid -> their school. Unknown -> physical.

  PARAMS   every field optional; FightFX.params(p) returns the filled copy.
           school  see above (physical)
           shape   a shape of the family (the family's first)
           size    0.5..2, scale of the whole effect (1)
           count   projectiles / cuts / strikes / motes (a per-family default; 0 = default)
           speed   0.5..2, tempo; >1 is faster and shrinks every duration (1)
           arc     0..1, lob height, sweep width or beam waver (per-family default)
           sound   0..3, the sound variant within the school (0)
           seed    integer jitter so two skills on the same params still differ (0)
           area    floor-ring radius in px for nova and lob splashes; 0 or omitted = fitted to the targets' spread
           crit    true for a bigger impact flourish (the stamp and number are separate calls)
           miss    true when the blow misses: smears whiff high, missiles fly past or stick in the floor, no sparks
           tint    "#rrggbb", overrides the school's main colour

  TIMING   FightFX.timing(family, params, from, to) -> {dur, impact, impacts, windup, marks}
           dur      seconds until the effect has finished drawing
           impact   the first hit: apply hp, pop the number, start hit-stop, play the impact sting here
           impacts  one time per target, in `to` order (multi/flurry/chain/volley land one after another)
           windup   when the actor's wind-up ends and the motion starts
           marks    floor decals the effect leaves: [{kind, x, y, at, opts}]; add each to the floor layer at `at`
           Typical at speed 1 (impact/dur in s; melee foe 90px away, ranged 150px; distance stretches travel and waves):
             slash .27-.36/.67-.85  thrust .26-.45/.64-.95  smash .36-.77/.90-1.32  arrow .41-.82/.81-1.39
             bolt .34-.80/1.05-1.46  beam .38-.65/.93-1.25  nova .42-.58/1.10-1.60  heal .32-.52/1.07-1.11
             buff .30-.35/.95-1.15  summon .60-.85/1.10-1.45  curse .47-.80/1.12-1.55  guard .16-.32/.50-.95

  DRAWING  FightFX.play(ctx, family, params, from, to, t, layer) -> true while still drawing
           layer "floor" (rings, glyphs, ground glow: draw before sprites) or "fx" (default: after sprites).
           Call both each frame for a running effect. t is seconds since the action began (hold t still for hit-stop).
           FightFX.pose(family, params, role, t, from, to, i) -> {dx, dy, sx, sy, rot, white, alpha, tint, tintAmt}
           choreography for a sprite: role "actor" (wind-up squash, lunge with stretch, recoil) or "target" (flinch,
           knockback, white flash; i = its index in `to`). Draw the sprite offset by dx/dy, scaled sx/sy about its feet,
           tinted white by `white` (0..1), washed toward `tint` by `tintAmt` (0..1), rotated by `rot` and faded by `alpha`.
           For summon the target is the newcomer: its alpha/sy ramp it in, so draw it from the start of the action.
           A struck target's white is 1 at the impact; during hit-stop show it for the first 2 real frames only, then
           0, or it hides the smear and sparks for the rest of the freeze (tools/fx_gallery.html does this).
           FightFX.ring(ctx, x, y, r, t, params, mode) area ring on the floor; mode "tell" (pulsing before impact) or
           "hit" (shockwave out from impact; t since impact).

  IMPACT   FightFX.HITSTOP {hit, heavy, crit, ko} in seconds (4, 6, 8, 10 frames); FightFX.hitStop(kind).
           FightFX.shake(t, power, seed) -> [dx, dy] whole-pixel stage offset; t since impact, power 1 hit, 2 crit, 3 ko.
           FightFX.flash(ctx, w, h, t, strength) a 2-frame white flash over the stage; t since impact.
           FightFX.silhouette(img, colour) -> cached canvas of the sprite filled flat (white flash, black inverted frame).
           FightFX.sparks(ctx, x, y, t, opts) blood-free hit sparks; opts {school, count, size, dir (-1|1), seed, crit}.
           FightFX.number(ctx, style, text, x, y, t) -> true while visible; style "normal" "crit" "heal" "miss" "tick"
           "burn" "poison" "block". Pixel font, pops, rises, fades (about 1.1s; crit 1.4s).
           FightFX.stamp(ctx, kind, x, y, t, text) -> true while visible; kind "crit" "ko" "status" (status shows `text`,
           e.g. FROZEN, ROOTED). Slams in big, settles, fades (crit 1.0s, ko 1.6s, status 1.1s).
           FightFX.status(ctx, status, p, t) a looping overlay on a fighter: burn chill stun weaken blind poison marked
           charm bleed guard stealth. t is any running clock.
           FightFX.text(ctx, str, x, y, colour, scale, outline, align) the 3x5 pixel font, for labels.

  FLOOR    FightFX.floor(w, h) -> layer: add(kind, x, y, opts, t), draw(ctx, t), clear(). Decals persist all fight; fresh
           ones glow for a moment (embers in a scorch, a frost glint). Kinds: crack scorch frost vines stub skid scuff
           puddle rune holy ash gouge cut soot hoof. opts {size, seed, flip, school}.

  SOUND    Its own WebAudio context, following Settings (sound, master, sfx; "al.sound" when loaded alone) and first-click unlock.
           FightFX.sound(family, params, phase, delay) phase "cast" (at the action's start), "impact" (at impact) or
           "all" (both, the impact at the family's typical impact time); delay in seconds from now. For exact sync
           (hit-stop, slow-mo) call "cast" when the action starts and "impact" when the replay reaches the impact.
           FightFX.sting(kind, school, delay) kind "hit" "heavy" "crit" "ko" "miss" "block" "heal" "tick" "stamp" "whoosh".
           FightFX.audio.render(events, secs) -> Promise<AudioBuffer> offline (level checks), events
           [[t, "family", family, params, phase] | [t, "sting", kind, {school}]].

  LISTS    FightFX.ALIASES, STATUSES, DECALS, NUMBER_STYLES; FightFX.school(id) -> the school an id or alias resolves to.

  SETUP    FightFX.config({flat, scale}) once: flat is the ground squash (0.32 for S), scale multiplies every size (1 at
           384x216). FightFX.reduced() is true under reduced motion (Settings, else prefers-reduced-motion) (the kit shakes and flashes less).
*/
(function (root) {
  "use strict";
  const TAU = Math.PI * 2, fl = Math.floor, rnd = Math.round;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
  const eOut = (t) => 1 - (1 - t) * (1 - t);
  const eOut3 = (t) => 1 - Math.pow(1 - t, 3);
  const eIn = (t) => t * t;
  const sm = (t) => t * t * (3 - 2 * t);
  const mod = (a, n) => (((a | 0) % n) + n) % n;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  let FLAT = 0.32, SCALE = 1;

  // integer hash -> [0, 1): every particle's randomness comes from (seed, index, channel), never from state
  function hs(a, b, c) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x27d4eb2f, 0x165667b1);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const hr = (s, i, c, a, b) => a + (b - a) * hs(s, i, c);
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- schools: palette [deep, dark, mid, light, hot] and the material their magic is made of ----------
  const SMOKE = ["#3c3632", "#6a625a", "#9a9288", "#c4bcb0"];
  const DUST = ["#5a4630", "#8a7050", "#b49a74", "#d8c4a0"];
  const STONE = ["#3a3026", "#6a5a46", "#a08a6a", "#cdbb98"];
  const SCHOOLS = {
    physical: { pal: ["#3a2c22", "#8a7a64", "#d8ccb0", "#f6ecd0", "#ffffff"], p: "spark", q: "dust", head: "streak", burst: "spark", decal: null, snd: "thud" },
    blade:    { pal: ["#2a2e3a", "#6a7488", "#b8c4d4", "#e8eef6", "#ffffff"], p: "spark", q: "glint", head: "streak", burst: "spark", decal: "cut", snd: "steel" },
    shield:   { pal: ["#4a3418", "#a07a3a", "#e0b860", "#fff0b8", "#ffffff"], p: "glint", q: "spark", head: "streak", burst: "spark", decal: "scuff", snd: "clang" },
    fury:     { pal: ["#3c0808", "#9a1a14", "#e0402c", "#ff9a6a", "#fff0d0"], p: "streak", q: "steam", head: "streak", burst: "spark", decal: "crack", snd: "roar" },
    command:  { pal: ["#4a1210", "#a8302a", "#e8b040", "#fff0a8", "#ffffff"], p: "chevron", q: "glint", head: "streak", burst: "spark", decal: "scuff", snd: "horn" },
    flame:    { pal: ["#5a1408", "#c03818", "#f08428", "#ffd25a", "#fff8d0"], p: "tongue", q: "ember", head: "flame", burst: "tongue", decal: "scorch", snd: "fire", smoke: 1 },
    frost:    { pal: ["#16305a", "#3470b8", "#78c0ec", "#cdeeff", "#ffffff"], p: "shard", q: "flake", head: "shard", burst: "shard", decal: "frost", snd: "ice" },
    storm:    { pal: ["#1c2058", "#4a5ad8", "#90b4ff", "#e4ecff", "#ffffff"], p: "fork", q: "spark", head: "fork", burst: "fork", decal: "scorch", snd: "zap" },
    arcane:   { pal: ["#0e2e3a", "#1a7a8a", "#4ad0c8", "#b8fff0", "#ffffff"], p: "rune", q: "mote", head: "rune", burst: "rune", decal: "rune", snd: "arcane", acc: "#f0d070" },
    lore:     { pal: ["#2a1e14", "#6a5030", "#c8a860", "#f4e4b0", "#fffbe8"], p: "rune", q: "page", head: "rune", burst: "page", decal: "rune", snd: "lore", acc: "#3a6ab0" },
    holy:     { pal: ["#6a4808", "#c89020", "#f4d050", "#fff4b0", "#ffffff"], p: "mote", q: "glint", head: "spear", burst: "glint", decal: "holy", snd: "holy" },
    healing:  { pal: ["#14482a", "#2c9a50", "#7ae07a", "#d4ffc8", "#ffffff"], p: "plus", q: "mote", head: "spear", burst: "plus", decal: null, snd: "heal" },
    shadow:   { pal: ["#0a0810", "#221830", "#4a3666", "#8a70b0", "#d8c8f0"], p: "wisp", q: "mote", head: "wisp", burst: "wisp", decal: "soot", snd: "shadow" },
    death:    { pal: ["#0e120c", "#2c3a22", "#6a8a4a", "#b8d890", "#eaffd0"], p: "wisp", q: "skull", head: "skull", burst: "wisp", decal: "ash", snd: "death" },
    wild:     { pal: ["#1c3410", "#3a7a24", "#7cc040", "#d0f080", "#fffbd0"], p: "leaf", q: "thorn", head: "thorn", burst: "leaf", decal: "vines", snd: "wild", acc: "#6a4422" },
    beast:    { pal: ["#2c1a0e", "#7a4e28", "#c08848", "#f0d8a8", "#ffffff"], p: "streak", q: "dust", head: "streak", burst: "spark", decal: "gouge", snd: "beast" },
    marksman: { pal: ["#3a2614", "#8a5e30", "#d4c4a4", "#f4ecdc", "#ffffff"], p: "feather", q: "spark", head: "streak", burst: "spark", decal: "stub", snd: "bow" },
    road:     { pal: ["#3c2c1c", "#7a6040", "#bca078", "#e8d8b0", "#fff8e8"], p: "dust", q: "spark", head: "streak", burst: "spark", decal: "skid", snd: "thud" },
    riding:   { pal: ["#3c2c1c", "#7a5a38", "#c09a6a", "#ecdcb4", "#fff8e8"], p: "dust", q: "spark", head: "streak", burst: "spark", decal: "hoof", snd: "hooves" },
    trade:    { pal: ["#4a3008", "#a07818", "#e8c440", "#fff0a0", "#ffffff"], p: "coin", q: "glint", head: "coin", burst: "coin", decal: null, snd: "coin" },
    song:     { pal: ["#4a1830", "#b04a70", "#f090a8", "#ffe0d0", "#ffffff"], p: "note", q: "mote", head: "note", burst: "note", decal: null, snd: "song" },
    illusion: { pal: ["#3a1a2a", "#a8507a", "#f0a0c0", "#c4f4e6", "#ffffff"], p: "facet", q: "glint", head: "facet", burst: "facet", decal: null, snd: "illusion", acc: "#7ae4cc" },
    hearth:   { pal: ["#4a2408", "#b05a18", "#f0a040", "#ffe0a0", "#fff8e0"], p: "ember", q: "steam", head: "flame", burst: "ember", decal: "soot", snd: "hearth" },
    craft:    { pal: ["#1e1e24", "#5a5a66", "#a8a0a0", "#e8c070", "#fff4d0"], p: "cog", q: "spark", head: "cog", burst: "cog", decal: "soot", snd: "craft" },
    poison:   { pal: ["#1a2808", "#4a7a10", "#94d030", "#e0ff90", "#ffffe0"], p: "drip", q: "bubble", head: "spit", burst: "drip", decal: "puddle", snd: "poison" },
    water:    { pal: ["#0a1830", "#1c4a80", "#4a90d0", "#b0e0ff", "#ffffff"], p: "drip", q: "bubble", head: "spit", burst: "drip", decal: "puddle", snd: "water" },
    bone:     { pal: ["#2a2420", "#7a7060", "#d8d0b8", "#f8f4e4", "#ffffff"], p: "bone", q: "dust", head: "bone", burst: "bone", decal: "crack", snd: "bone" },
  };
  const ALIAS = { fire: "flame", ice: "frost", lightning: "storm", nature: "wild", light: "holy", rage: "fury", dark: "shadow",
    necro: "death", venom: "poison", acid: "poison", ink: "shadow", heal: "healing", steel: "blade", physic: "physical" };
  for (const k in SCHOOLS) SCHOOLS[k].id = k;
  const tinted = new Map();
  function school(P) {
    const id = SCHOOLS[P.school] ? P.school : ALIAS[P.school] || "physical", s = SCHOOLS[id];
    if (!P.tint) return s;
    const key = id + P.tint;
    if (!tinted.has(key)) {
      const c = hexRgb(P.tint), mix = (k, f) => rgbHex(c.map((v) => clamp(rnd(v * f), 0, 255)));
      tinted.set(key, Object.assign({}, s, { pal: [mix(0, 0.3), mix(1, 0.62), P.tint, rgbHex(c.map((v) => rnd(v + (255 - v) * 0.55))), "#ffffff"] }));
    }
    return tinted.get(key);
  }
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgbHex(c) { return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); }

  // ---------- pixel primitives: crisp fills only, transparency by ordered dither ----------
  let C = null, cur = null;
  function use(ctx) { C = ctx; cur = null; }
  function fs(col) { if (col !== cur) { C.fillStyle = col; cur = col; } }
  const on = (x, y, a) => a >= 1 || (a > 0 && BAYER[((fl(y) & 3) << 2) | (fl(x) & 3)] < a);
  function P(x, y, col) { fs(col); C.fillRect(fl(x), fl(y), 1, 1); }
  function Pa(x, y, col, a) { if (on(x, y, a)) { fs(col); C.fillRect(fl(x), fl(y), 1, 1); } }
  function Rt(x, y, w, h, col) { fs(col); C.fillRect(fl(x), fl(y), w, h); }
  function line(x0, y0, x1, y1, col, a) {
    x0 = fl(x0); y0 = fl(y0); x1 = fl(x1); y1 = fl(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    if (a === undefined) a = 1;
    fs(col);
    for (;;) {
      if (on(x0, y0, a)) C.fillRect(x0, y0, 1, 1);
      if ((x0 === x1 && y0 === y1) || ++n > 600) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // a line whose colour comes from fn(u) along it (u 0 at the start); fn may return null to skip a pixel
  function lineFn(x0, y0, x1, y1, fn) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const u = i / n, c = fn(u);
      if (c) P(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, c);
    }
  }
  function poly(pts, col, a) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const ya = Math.ceil(y0 - 0.5), yb = fl(y1 - 0.5), xs = [];
    if (a === undefined) a = 1;
    fs(col);
    for (let y = ya; y <= yb; y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0, n = pts.length; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        if ((p[1] <= cy && q[1] > cy) || (q[1] <= cy && p[1] > cy)) xs.push(p[0] + (cy - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
      }
      xs.sort((m, k) => m - k);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5), xb = fl(xs[k + 1] - 0.5);
        if (xb < xa) continue;
        if (a >= 1) C.fillRect(xa, y, xb - xa + 1, 1);
        else for (let x = xa; x <= xb; x++) if (on(x, y, a)) C.fillRect(x, y, 1, 1);
      }
    }
  }
  // a round blob (smoke, dust, glow), shaded light from the top left; a < 1 dithers it away
  function blob(x, y, r, cols, a) {
    if (r < 0.7) { Pa(x, y, cols[1], a); return; }
    const ri = Math.ceil(r), r2 = r * r;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r2) continue;
      const px = x + dx, py = y + dy;
      if (!on(px, py, a)) continue;
      const lit = (dx + dy) / r;
      P(px, py, d > r2 * 0.6 && lit > 0.3 ? cols[0] : lit < -0.5 ? cols[2] : cols[1]);
    }
  }
  // the ground plane: an ellipse flattened by FLAT, as a dotted or solid ring or a filled patch
  function gring(cx, cy, r, col, a, thick, dash, a0, a1) {
    if (r < 1) return;
    const n = Math.max(24, fl(r * 5)), st = a0 === undefined ? 0 : a0, en = a1 === undefined ? TAU : a1;
    for (let i = 0; i < n; i++) {
      const th = st + (en - st) * i / n;
      if (dash && fl(th / TAU * dash * 2) % 2) continue;
      for (let k = 0; k < (thick || 1); k++) Pa(cx + Math.cos(th) * (r - k), cy + Math.sin(th) * (r - k) * FLAT, col, a);
    }
  }
  function gdisc(cx, cy, r, col, a) {
    const ry = r * FLAT;
    if (ry < 0.5) return;
    for (let dy = -fl(ry); dy <= fl(ry); dy++) {
      const hw = r * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)));
      for (let x = fl(cx - hw); x <= fl(cx + hw); x++) Pa(x, cy + dy, col, a);
    }
  }

  // ---------- tiny bitmaps ----------
  const bm = (s) => s.split(",").map((r) => r.split("").map(Number));
  const RUNES = ["00100,01110,10101,00100,00100", "10001,01010,00100,01010,10001", "11100,10100,11111,00101,00111", "00100,01010,10001,01010,00100",
    "10101,10101,01110,00100,00100", "11110,10001,11110,10100,10010", "10000,11000,10100,10010,10001", "01110,10001,10101,10001,01110",
    "11111,00100,01110,10101,00100", "10010,10100,11000,10100,10010"].map(bm);
  const MINIRUNE = ["010,111,010", "101,010,101", "110,011,110", "111,101,010", "100,111,001"].map(bm);
  const BMP = {
    note: bm("011,010,010,110,110"), note2: bm("0111,0101,0101,1101,1101"), skull: bm("01110,11111,10101,11111,01010"),
    heart: bm("01010,11111,01110,00100"), cog: bm("01010,11111,11011,11111,01010"), flake: bm("00100,10101,01110,10101,00100"),
    star: bm("00100,00100,11111,01110,01010"), page: bm("1111,1001,1111,1111"), q: bm("111,001,010,000,010"),
  };
  // a bitmap with a dark rim below-right, so small light glyphs still read on pale ground
  function bmpS(b, x, y, col, rim, a, sc) { sc = sc || 1; bmp(b, x + 1, y + 1, rim, a, null, sc); bmp(b, x, y, col, a, null, sc); }
  function bmp(b, x, y, col, a, col2, sc) {
    x = fl(x); y = fl(y); sc = sc || 1;
    for (let j = 0; j < b.length; j++) for (let i = 0; i < b[j].length; i++) {
      const v = b[j][i];
      if (v && (a === undefined || on(x + i * sc, y + j * sc, a))) Rt(x + i * sc, y + j * sc, sc, sc, v === 2 && col2 ? col2 : col);
    }
  }

  // ---------- shaped particles ----------
  // a flame tongue: a teardrop licking back along ang (the direction of travel), hotter in the middle while young
  function tongue(x, y, s, ang, heat, pal, a) {
    const c = Math.cos(ang), si = Math.sin(ang);
    if (s < 1.3) { Pa(x, y, heat > 0.6 ? pal[3] : pal[2], a); Pa(x - c, y - si, pal[1], a); return; }
    const tip = [x - c * s * 2.4, y - si * s * 2.4];
    poly([tip, [x - si * s, y + c * s], [x + c * s * 0.9, y + si * s * 0.9], [x + si * s, y - c * s]], heat < 0.45 ? pal[1] : pal[2], a);
    if (s >= 2 && heat > 0.25) {
      const k = 0.6;
      poly([[x - c * s * 1.5, y - si * s * 1.5], [x - si * s * k, y + c * s * k], [x + c * s * 0.55, y + si * s * 0.55], [x + si * s * k, y - c * s * k]], heat > 0.6 ? pal[3] : pal[2], a);
    }
    if (heat > 0.55 && s >= 2.4) Pa(x, y, pal[4], a);
  }
  // an ice shard: a long diamond along ang with a lit top edge and a hot tip
  function shard(x, y, len, ang, pal, a) {
    const c = Math.cos(ang), si = Math.sin(ang), w = Math.max(0.8, len * 0.24);
    const tip = [x + c * len, y + si * len], back = [x - c * len * 0.5, y - si * len * 0.5];
    const up = [x + si * w, y - c * w], dn = [x - si * w, y + c * w];
    if (len < 2.5) { line(back[0], back[1], tip[0], tip[1], pal[2], a); Pa(tip[0], tip[1], pal[4], a); return; }
    poly([tip, up, back, dn], pal[2], a);
    line(up[0], up[1], tip[0], tip[1], pal[3], a);
    line(dn[0], dn[1], tip[0], tip[1], pal[1], a);
    Pa(tip[0], tip[1], pal[4], a);
    Pa(x + c * len * 0.5, y + si * len * 0.5 - (c > 0 ? 0 : 0), pal[4], a);
  }
  // forked lightning between two points: midpoint displacement, flickering when the seed changes
  function forkPts(x0, y0, x1, y1, seed, rough) {
    let pts = [[x0, y0], [x1, y1]];
    const L = Math.hypot(x1 - x0, y1 - y0);
    for (let gen = 0; gen < 7; gen++) {
      const nx = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d > 5) {
          const off = (hs(seed, gen * 97 + i, 3) - 0.5) * d * rough, px = -(q[1] - p[1]) / d, py = (q[0] - p[0]) / d;
          nx.push([(p[0] + q[0]) / 2 + px * off, (p[1] + q[1]) / 2 + py * off]);
        }
        nx.push(q);
      }
      pts = nx;
      if (L / pts.length < 3) break;
    }
    return pts;
  }
  function polyline(pts, col, a, dx, dy) {
    for (let i = 1; i < pts.length; i++) line(pts[i - 1][0] + (dx || 0), pts[i - 1][1] + (dy || 0), pts[i][0] + (dx || 0), pts[i][1] + (dy || 0), col, a);
  }
  function fork(x0, y0, x1, y1, seed, pal, a, thick, branches) {
    const pts = forkPts(x0, y0, x1, y1, seed, 0.55);
    if (thick) {
      polyline(pts, pal[1], a * 0.45, -2, 0); polyline(pts, pal[1], a * 0.45, 2, 0);
      polyline(pts, pal[2], a, -1, 0); polyline(pts, pal[2], a, 1, 0); polyline(pts, pal[3], a, 0, -1);
    }
    polyline(pts, thick ? pal[4] : pal[3], a);
    const L = Math.hypot(x1 - x0, y1 - y0);
    for (let b = 0; b < (branches || 0); b++) {
      const k = 2 + fl(hs(seed, b, 9) * (pts.length - 4)), p = pts[clamp(k, 0, pts.length - 1)];
      const base = Math.atan2(y1 - y0, x1 - x0) + (hs(seed, b, 10) < 0.5 ? -1 : 1) * hr(seed, b, 11, 0.4, 1.0), bl = L * hr(seed, b, 12, 0.15, 0.35);
      polyline(forkPts(p[0], p[1], p[0] + Math.cos(base) * bl, p[1] + Math.sin(base) * bl, seed + b * 31, 0.7), pal[2], a);
    }
    return pts;
  }
  // a soft dithered glow behind a magic head, which keeps it readable on pale stone
  function halo(x, y, r, pal, a) {
    const ri = Math.ceil(r), r2 = r * r;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = (dx * dx + dy * dy) / r2;
      if (d > 1) continue;
      Pa(x + dx, y + dy, d < 0.3 ? pal[3] : pal[2], a * (1 - d) * (d < 0.3 ? 0.8 : 0.6));
    }
  }
  function star(x, y, r, pal, a) {
    r = Math.max(1, r);
    line(x - r, y, x + r, y, pal[3], a); line(x, y - r, x, y + r, pal[3], a);
    const d = r * 0.45;
    if (d >= 1) { line(x - d, y - d, x + d, y + d, pal[2], a); line(x - d, y + d, x + d, y - d, pal[2], a); }
    if (r >= 3) { line(x - r * 0.5, y, x + r * 0.5, y, pal[4], a); line(x, y - r * 0.5, x, y + r * 0.5, pal[4], a); }
    Pa(x, y, pal[4], a);
  }
  function plus(x, y, s, pal, a) {
    if (s >= 1.6) { Rt(x - 1, y - 2, 3, 5, pal[1]); Rt(x - 2, y - 1, 5, 3, pal[1]); Rt(x, y - 1, 1, 3, pal[3]); Rt(x - 1, y, 3, 1, pal[3]); P(x, y, pal[4]); return; }
    Pa(x, y, pal[4], a); Pa(x - 1, y, pal[2], a); Pa(x + 1, y, pal[2], a); Pa(x, y - 1, pal[2], a); Pa(x, y + 1, pal[2], a);
  }
  function leaf(x, y, ang, pal, a, s) {
    const c = Math.cos(ang), si = Math.sin(ang), L = 1.8 * (s || 1);
    poly([[x + c * L, y + si * L], [x - si * L * 0.6, y + c * L * 0.6], [x - c * L, y - si * L], [x + si * L * 0.6, y - c * L * 0.6]], pal[2], a);
    Pa(x - si * 0.5 + c * 0.5, y + c * 0.5 + si * 0.5, pal[3], a);
    Pa(x - c * L, y - si * L, pal[1], a);
  }
  function thorn(x, y, ang, pal, a) {
    const c = Math.cos(ang), si = Math.sin(ang);
    poly([[x + c * 3, y + si * 3], [x - si * 1.2, y + c * 1.2], [x + si * 1.2, y - c * 1.2]], pal[1], a);
    Pa(x + c * 2.5, y + si * 2.5, pal[3], a);
  }
  // a smoky tendril, curling as it ages
  function wisp(x, y, s, ang, pal, a, ph) {
    const c = Math.cos(ang), si = Math.sin(ang), n = Math.max(3, rnd(4 * s));
    for (let k = 0; k < n; k++) {
      const w = Math.sin(k * 0.9 + ph) * 1.3 * s;
      Pa(x - c * k - si * w, y - si * k + c * w, k === 0 ? pal[4] : k < n / 2 ? pal[3] : pal[2], a * (1 - k / (n + 1)));
    }
  }
  function drip(x, y, len, pal, a) {
    for (let k = 0; k < len; k++) Pa(x, y - k, k > len - 2 ? pal[2] : pal[3], a);
    Pa(x, y + 1, pal[2], a); Pa(x - 1, y + 1, pal[1], a); Pa(x + 1, y + 1, pal[2], a); Pa(x, y + 2, pal[1], a); Pa(x, y, pal[4], a);
  }
  function bubble(x, y, pal, a, pop) {
    if (pop) { for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) Pa(x + dx, y + dy, pal[3], a); return; }
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Pa(x + dx, y + dy, pal[2], a);
    Pa(x - 1, y - 1, pal[4], a);
  }
  function coin(x, y, ph, pal, a, s) {
    const big = (s || 1) > 1.1, R = big ? 2.5 : 1.5, w = Math.abs(Math.cos(ph)), hw = Math.max(0.5, R * w);
    if (a !== undefined && a < 1 && !on(x, y, a)) return;
    Rt(x - hw - 0.5, y - R - 0.5, hw * 2 + 2, R * 2 + 2, pal[0]);
    Rt(x - hw, y - R, Math.max(1, hw * 2 + 1), R * 2 + 1, pal[2]);
    if (hw > 1) { P(x - hw + 1, y - R + 1, pal[4]); Rt(x - hw + 1, y + R - 1, Math.max(1, hw * 2 - 1), 1, pal[1]); }
  }
  function feather(x, y, ang, pal, a) {
    const c = Math.cos(ang), si = Math.sin(ang);
    for (let k = -2; k <= 2; k++) { Pa(x + c * k, y + si * k, pal[3], a); if (k > -2 && k < 2) Pa(x + c * k - si, y + si * k + c, pal[2], a); }
  }
  function bone(x, y, ang, pal, a) {
    const c = Math.cos(ang), si = Math.sin(ang);
    for (let k = -2; k <= 2; k++) Pa(x + c * k, y + si * k, pal[3], a);
    Pa(x + c * 2.5 - si, y + si * 2.5 + c, pal[3], a); Pa(x - c * 2.5 - si, y - si * 2.5 + c, pal[3], a);
    Pa(x + c * 2.5 + si, y + si * 2.5 - c, pal[2], a); Pa(x - c * 2.5 + si, y - si * 2.5 - c, pal[2], a);
  }
  function chevron(x, y, w, col, col2, a) {
    line(x - w, y + w, x, y, col, a); line(x, y, x + w, y + w, col, a);
    line(x - w, y + w + 1, x, y + 1, col2, a); line(x, y + 1, x + w, y + w + 1, col2, a);
  }
  function spark(x, y, vx, vy, len, pal, a) {
    const v = Math.hypot(vx, vy) || 1, ux = vx / v, uy = vy / v;
    lineFn(x - ux * len, y - uy * len, x, y, (u) => (on(x - ux * len * (1 - u), y, a) ? (u > 0.8 ? pal[4] : u > 0.4 ? pal[3] : pal[2]) : null));
  }

  // one particle of a kind; life 0 (fresh) .. 1 (gone); s ~1 is normal size; i picks a variant (rune glyph, leaf turn)
  function part(kind, x, y, s, ang, life, S, i, ph) {
    const pal = S.pal, a = life < 0.6 ? 1 : 1 - (life - 0.6) / 0.4;
    if (life >= 1 || life < 0) return;
    switch (kind) {
      case "tongue":
        if (life > 0.7 && S.smoke) { blob(x, y - (life - 0.7) * 10, 1 + s * 0.6, SMOKE, (1 - life) * 2.2); return; }
        tongue(x, y, (1.2 + 2.4 * s) * (1 - life * 0.7), ang, 1 - life, pal, a); return;
      case "ember": Pa(x, y, life < 0.3 ? pal[4] : life < 0.6 ? pal[3] : pal[2], a); Pa(x - Math.cos(ang), y - Math.sin(ang), pal[1], a * 0.8); return;
      case "smoke": blob(x, y, 0.8 + s * (1 + life * 1.6), SMOKE, (1 - life) * 0.9); return;
      case "steam": blob(x, y, 0.7 + s * (0.8 + life * 1.4), ["#9a9a9a", "#d8d4cc", "#f4f0e8"], (1 - life) * 0.7); return;
      case "dust": blob(x, y, 0.8 + s * (0.8 + life * 1.8), DUST, (1 - life) * 0.95); return;
      case "shard": shard(x, y, 1.5 + 3 * s * (1 - life * 0.4), ang, pal, a); return;
      case "flake": if (s > 1.2) bmp(BMP.flake, x - 2, y - 2, pal[3], a); else { Pa(x, y, pal[4], a); Pa(x - 1, y, pal[3], a * 0.7); Pa(x + 1, y, pal[3], a * 0.7); Pa(x, y - 1, pal[3], a * 0.7); Pa(x, y + 1, pal[3], a * 0.7); } return;
      case "fork": { const L = 3 + 3 * s; fork(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, (i || 0) * 13 + fl((ph || 0) * 8), pal, a, false, 0); Pa(x, y, pal[4], a); return; }
      case "spark": spark(x, y, Math.cos(ang), Math.sin(ang), 1 + 2.5 * s * (1 - life), pal, a); return;
      case "streak": { const L = 7 * s, c = Math.cos(ang), sn = Math.sin(ang); lineFn(x - c * L, y - sn * L, x, y, (u) => (on(x + u * 3, y, a * (0.3 + u)) ? (u > 0.82 ? pal[4] : u > 0.55 ? pal[3] : u > 0.3 ? pal[2] : pal[1]) : null)); lineFn(x - c * L * 0.7 - sn, y - sn * L * 0.7 + c, x - sn, y + c, (u) => (on(x + u * 3, y + 1, a * u) ? pal[1] : null)); return; }
      case "glint": star(x, y, 1 + 2 * s * (1 - Math.abs(life * 2 - 0.6)), pal, a); return;
      case "mote": { const tw = (fl((ph || 0) * 10 + (i || 0)) % 3) === 0; if (tw && s > 0.8) plus(x, y, 1, pal, a); else { Pa(x, y, pal[4], a); Pa(x, y + 1, pal[2], a * 0.6); } return; }
      case "plus": plus(x, y, s > 1.1 ? 2 : 1, pal, a); return;
      case "rune": if (s > 1.1) { const z = s > 1.9 ? 2 : 1; bmpS(RUNES[mod(i, RUNES.length)], x - 2.5 * z, y - 2.5 * z, mod(fl((ph || 0) * 6) + (i || 0), 4) ? pal[3] : S.acc || pal[4], pal[0], a, z); } else bmpS(MINIRUNE[mod(i, MINIRUNE.length)], x - 1, y - 1, pal[3], pal[1], a); return;
      case "page": bmp(BMP.page, x - 2, y - 2, pal[3], a); Pa(x - 1, y - 1, pal[1], a); Pa(x, y, pal[1], a); return;
      case "leaf": leaf(x, y, ang + (ph || 0) * 3 + (i || 0), pal, a, 0.7 + s * 0.5); return;
      case "thorn": thorn(x, y, ang, pal, a); return;
      case "wisp": wisp(x, y, 0.7 + s * 0.7, ang, pal, a, (ph || 0) * 6 + (i || 0)); return;
      case "skull": if (s > 1.1) { bmp(BMP.skull, x - 2, y - 2, pal[3], a); Pa(x - 1, y, pal[0], a); Pa(x + 1, y, pal[0], a); } else wisp(x, y, 1, ang, pal, a, (ph || 0) * 6); return;
      case "drip": drip(x, y, 2 + rnd(s), pal, a); return;
      case "bubble": bubble(x, y, pal, a, life > 0.85); return;
      case "coin": coin(x, y, (ph || 0) * 14 + (i || 0), pal, a, s); return;
      case "cog": if (s > 1.1) { bmpS(BMP.cog, x - 2, y - 2, pal[3], pal[0], a); Pa(x, y, pal[0], a); } else { Pa(x, y, pal[3], a); Pa(x + 1, y, pal[2], a); Pa(x, y + 1, pal[1], a); } return;
      case "note": { const z = s > 1.5 ? 2 : 1; bmpS((i || 0) % 2 ? BMP.note : BMP.note2, x - 1.5 * z, y - 2.5 * z, pal[2], pal[0], a, z); return; }
      case "feather": feather(x, y, ang + Math.sin((ph || 0) * 5 + (i || 0)) * 0.8, pal, a); return;
      case "bone": bone(x, y, ang + (ph || 0) * 9, pal, a); return;
      case "heart": bmpS(BMP.heart, x - 2, y - 2, pal[2], pal[0], a); Pa(x - 1, y - 1, pal[4], a); return;
      case "chevron": chevron(x, y, 2 + rnd(s), pal[3], pal[1], a); return;
      case "petal": Pa(x, y, pal[3], a); Pa(x + (fl((ph || 0) * 8) % 2), y + 1, pal[2], a); return;
      case "facet": {
        const z = s > 1.1 ? 2 : 1, col = (fl((ph || 0) * 10) + (i || 0)) % 2 ? pal[2] : S.acc || pal[3];
        for (let d = -z; d <= z; d++) { Pa(x + d, y, col, a); Pa(x, y + d * 1.5, col, a); }
        Pa(x, y - z * 1.5 - 1, pal[0], a * 0.6); Pa(x, y, pal[4], a);
        return;
      }
      default: Pa(x, y, pal[3], a);
    }
  }

  // ---------- params and the per-call setup ----------
  const PCACHE = new WeakMap();
  function params(p) {
    if (p && PCACHE.has(p)) return PCACHE.get(p);
    const q = p || {};
    const out = {
      school: q.school || "physical", shape: q.shape || null, size: clamp(+q.size || 1, 0.4, 2.5), count: Math.max(0, q.count | 0),
      speed: clamp(+q.speed || 1, 0.3, 3), arc: q.arc == null ? null : clamp(+q.arc, 0, 1), sound: (q.sound | 0) & 3, seed: q.seed | 0,
      area: q.area == null ? null : Math.max(0, +q.area), crit: !!q.crit, miss: !!q.miss, tint: /^#[0-9a-f]{6}$/i.test(q.tint || "") ? q.tint : null,
    };
    if (p && typeof p === "object") PCACHE.set(p, out);
    return out;
  }
  const H0 = 30;
  const hgt = (p) => (p && p.h) || H0;
  const chest = (p) => ({ x: p.x, y: p.y - hgt(p) * 0.55 });
  const head = (p) => ({ x: p.x, y: p.y - hgt(p) });
  function list(from, to) {
    const a = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];
    return a.length ? a : [from];
  }
  function setup(fam, p, from, to) {
    const P = params(p), F = FAM[fam] || FAM.slash, tos = list(from, to);
    const S = school(P), k = P.size * SCALE;
    const sx = tos.reduce((m, q) => m + q.x, 0) / tos.length;
    const dir = sx === from.x ? (from.dir || 1) : sx > from.x ? 1 : -1;
    const X = { fam, F, P, S, pal: S.pal, k, dir, from, tos, shape: F.shapes.includes(P.shape) ? P.shape : F.shapes[0],
      seed: (P.seed * 7919 + strHash(fam + S.id)) | 0, arc: P.arc == null ? F.arc || 0 : P.arc };
    X.n = P.count || (F.count ? F.count(X) : 1);
    X.src = { x: from.x + dir * 6 * SCALE, y: from.y - hgt(from) * 0.6 };
    X.dst = tos.map(chest);
    X.cx = tos.reduce((m, q) => m + q.x, 0) / tos.length;
    X.cy = tos.reduce((m, q) => m + q.y, 0) / tos.length;
    X.area = P.area != null ? P.area * SCALE : 0;
    X.T = F.time(X);
    return X;
  }

  // ---------- motion ----------
  // a lob from (x0, y0) to (x1, y1) peaking h px above the straight line; returns [x, y, heading]
  function lob(x0, y0, x1, y1, h, u) {
    const x = lerp(x0, x1, u), y = lerp(y0, y1, u) - h * 4 * u * (1 - u);
    const dx = x1 - x0, dy = y1 - y0 - h * 4 * (1 - 2 * u);
    return [x, y, Math.atan2(dy, dx)];
  }

  const IMPACT = ["#5a3a10", "#e0a030", "#ffe080", "#fff8d8", "#ffffff"];
  // the hit: a two-frame star at the contact point, then the school's own debris; tt is seconds since the hit
  function burst(X, x, y, tt, dir, mul, kind) {
    if (tt < 0 || tt > 0.6) return;
    const S = X.S, pal = X.pal, k = X.k * (mul || 1) * 1.35, sd = X.seed + fl(x * 13 + y * 7);
    kind = kind || S.burst;
    if (tt < 0.08) {
      const physical = kind === "spark" || kind === "streak";
      if (tt < 0.035) halo(x, y, 6 * k, physical ? IMPACT : pal, 0.9);
      star(x, y, (tt < 0.035 ? 8 : 5) * k, physical ? IMPACT : [pal[1], pal[2], pal[3], pal[4], "#ffffff"], 1);
      if (tt < 0.035) gring(x, y + 1, 5 * k, "#ffffff", 0.6, 1, 0);
    }
    const n = rnd((kind === "tongue" ? 10 : kind === "rune" ? 7 : 13) * Math.min(1.4, mul || 1) * (X.P.crit ? 1.6 : 1));
    for (let i = 0; i < n; i++) {
      const sp = hr(sd, i, 1, 0.45, 1), life = tt / hr(sd, i, 2, 0.26, 0.48);
      if (life >= 1) continue;
      let ang = (dir > 0 ? 0 : Math.PI) + (hs(sd, i, 3) - 0.5) * 2.6 - 0.35 * dir * 0;
      switch (kind) {
        case "spark": case "streak": {
          ang = (dir > 0 ? 0 : Math.PI) + (hs(sd, i, 3) - 0.5) * 3.0;
          const v = 130 * sp * k, px = x + Math.cos(ang) * v * tt, py = y + Math.sin(ang) * v * tt + 160 * tt * tt;
          const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v + 320 * tt;
          if (kind === "spark") spark(px, py, vx, vy, (2 + 3 * sp) * (1 - life) * Math.min(1.4, k), i % 3 ? IMPACT : pal, 1 - life * life);
          else part("streak", px, py, 0.8 * k, Math.atan2(vy, vx), life, S, i);
          break;
        }
        case "tongue": {
          if (i < 4) { const ox = (i - 1.5) * 3 * k; part("tongue", x + ox, y - tt * 40 * sp, 0.8 * k, -Math.PI / 2 + (hs(sd, i, 4) - 0.5) * 0.6, life, S, i); }
          else { const v = 90 * sp * k; part("ember", x + Math.cos(ang) * v * tt, y + Math.sin(ang) * v * tt - 20 * tt + 60 * tt * tt, k, ang, life, S, i); }
          break;
        }
        case "shard": {
          const v = 110 * sp * k;
          part("shard", x + Math.cos(ang) * v * tt, y + Math.sin(ang) * v * tt + 140 * tt * tt, 0.7 * k, ang, life, S, i);
          if (i % 3 === 0) part("flake", x + Math.cos(ang) * v * 0.5 * tt, y - 10 * tt, 0.6, 0, life, S, i);
          break;
        }
        case "fork": {
          if (i < 4) { const a2 = hs(sd, i, 5) * TAU, L = (5 + 8 * sp) * k; if (fl(tt * 30) % 2 === 0 || life < 0.4) fork(x, y, x + Math.cos(a2) * L, y + Math.sin(a2) * L * 0.8, sd + i + fl(tt * 20), pal, 1 - life, false, 0); }
          else { const v = 120 * sp * k; spark(x + Math.cos(ang) * v * tt, y + Math.sin(ang) * v * tt + 120 * tt * tt, Math.cos(ang), Math.sin(ang), 2, pal, 1 - life); }
          break;
        }
        case "rune": {
          const a2 = i / n * TAU + tt * 3, r = (4 + 26 * eOut(tt / 0.45)) * k;
          part("rune", x + Math.cos(a2) * r, y + Math.sin(a2) * r * 0.55, k * 1.3, 0, life, S, i + X.seed, tt);
          break;
        }
        case "page": {
          const v = 60 * sp * k;
          part(i % 2 ? "page" : "rune", x + Math.cos(ang) * v * tt, y + Math.sin(ang) * v * tt + 40 * tt * tt, 1.3, 0, life, S, i, tt);
          break;
        }
        case "leaf": {
          const v = 70 * sp * k, sway = Math.sin(tt * 12 + i) * 3;
          part("leaf", x + Math.cos(ang) * v * tt + sway, y + Math.sin(ang) * v * tt * 0.6 + 50 * tt * tt, k, ang, life, S, i, tt);
          break;
        }
        case "plus": case "glint": case "mote": case "note": {
          const v = 40 * sp * k;
          part(kind === "glint" && i % 2 ? "mote" : kind, x + Math.cos(ang) * v * tt * 0.8, y - (20 + 30 * sp) * tt * k + Math.sin(ang) * 6 * tt, k * 1.2, 0, life, S, i, tt);
          break;
        }
        case "coin": case "cog": case "bone": {
          const v = 90 * sp * k, up = -70 * k;
          part(kind, x + Math.cos(ang) * v * tt * 0.7, y + up * tt + 280 * tt * tt, k * 1.3, ang, life, S, i, tt);
          break;
        }
        case "drip": {
          const v = 80 * sp * k, a2 = -Math.PI / 2 + (hs(sd, i, 6) - 0.5) * 2.4;
          part(i % 3 ? "drip" : "bubble", x + Math.cos(a2) * v * tt, y + Math.sin(a2) * v * tt + 260 * tt * tt, k, 0, life, S, i, tt);
          break;
        }
        case "wisp": {
          const v = 50 * sp * k, a2 = hs(sd, i, 7) * TAU;
          part(i % 4 === 0 && S.q === "skull" ? "skull" : "wisp", x + Math.cos(a2) * v * tt, y + Math.sin(a2) * v * tt * 0.7 - 10 * tt, k * 1.2, a2 + Math.PI, life, S, i, tt);
          break;
        }
        default: {
          const v = 80 * sp * k;
          part(kind, x + Math.cos(ang) * v * tt, y + Math.sin(ang) * v * tt + 100 * tt * tt, k, ang, life, S, i, tt);
        }
      }
    }
    // physical hits also kick out a little dust and a puff ring at the contact point
    if ((kind === "spark" || kind === "streak") && tt < 0.2) gring(x, y, (3 + tt * 60) * k, IMPACT[3], 1 - tt / 0.2, 1, 6);
  }

  // a shaped projectile: the head at u along the path, the trail behind it; path(v) -> [x, y, heading]
  function missile(X, path, u, mul, style, sd) {
    const S = X.S, pal = X.pal, k = X.k * (mul || 1) * 1.5, hd = style || S.head;
    sd = sd || X.seed;
    const [hx, hy, ang] = path(u);
    if (hd !== "streak" && hd !== "coin" && hd !== "bone" && hd !== "note") halo(hx, hy, 4.5 * k, pal, 0.55);
    switch (hd) {
      case "flame": {
        const N = 26, span = 0.5;
        for (let i = N; i >= 0; i--) {
          const v = u - span * i / N;
          if (v < 0) continue;
          const [x, y, a] = path(v), age = i / N, jx = hr(sd, i, 1, -1.4, 1.4) * k, jy = hr(sd, i, 2, -1.4, 1.4) * k;
          if (age > 0.75) { if (i % 2 === 0 && S.smoke) blob(x + jx, y + jy - (age - 0.75) * 14, 1 + k * 0.8, SMOKE, (1 - age) * 3); continue; }
          const heat = 1 - age / 0.75;
          tongue(x + jx, y + jy, (1.1 + heat * 3) * k, a, heat, pal);
        }
        tongue(hx, hy, 4 * k, ang, 1, pal);
        Pa(hx + Math.cos(ang), hy + Math.sin(ang), pal[4], 1);
        break;
      }
      case "shard": {
        for (let i = 1; i < 18; i++) {
          const v = u - i * 0.025;
          if (v < 0) break;
          const [x, y] = path(v), age = i / 18;
          Pa(x + hr(sd, i, 3, -2, 2) * k, y + hr(sd, i, 4, -2, 2) * k, i % 3 ? pal[3] : pal[4], 1 - age);
          if (i % 4 === 0) part("flake", x, y + age * 12, k * 0.9, 0, age, S, i);
        }
        shard(hx, hy, 7 * k, ang, pal);
        shard(hx - Math.cos(ang) * 3 * k + Math.sin(ang) * 2 * k, hy - Math.sin(ang) * 3 * k - 2 * k * Math.cos(ang), 3.5 * k, ang - 0.25, pal);
        shard(hx - Math.cos(ang) * 3 * k - Math.sin(ang) * 2 * k, hy - Math.sin(ang) * 3 * k + 2 * k * Math.cos(ang), 3.5 * k, ang + 0.25, pal);
        break;
      }
      case "fork": {
        const fk = fl(u * 40), back = Math.max(0, u - 0.3), [bx, by] = path(back), [mx, my] = path((u + back) / 2);
        fork(bx, by, mx, my, sd + fk, pal, 0.55, false, 1);
        fork(mx, my, hx, hy, sd + fk + 1, pal, 1, true, 2);
        for (let b = 0; b < 4; b++) { const a2 = hs(sd + fk, b, 7) * TAU, L = 5 * k; fork(hx, hy, hx + Math.cos(a2) * L, hy + Math.sin(a2) * L, sd + fk + b, pal, 0.9, false, 0); }
        star(hx, hy, 3.5 * k, pal, 1);
        break;
      }
      case "rune": {
        for (let i = 1; i < 6; i++) {
          const v = u - i * 0.07;
          if (v < 0) break;
          const [x, y] = path(v);
          part("rune", x, y - i * 1.5, 0.9, 0, i / 6, S, i + sd, u);
        }
        for (let j = 0; j < 3; j++) { const a2 = u * 14 + j * TAU / 3; part("rune", hx + Math.cos(a2) * 4 * k, hy + Math.sin(a2) * 3 * k, k > 0.9 ? 1.3 : 0.9, 0, 0.1, S, j + sd, u); }
        bmp(RUNES[mod(sd + fl(u * 6), RUNES.length)], hx - 2.5 * (k > 1.25 ? 2 : 1), hy - 2.5 * (k > 1.25 ? 2 : 1), pal[4], 1, null, k > 1.25 ? 2 : 1);
        star(hx, hy, 2.5 * k, pal, 1);
        break;
      }
      case "spear": {
        for (let i = 1; i < 14; i++) {
          const v = u - i * 0.03;
          if (v < 0) break;
          const [x, y] = path(v);
          if (i % 2) part("mote", x + hr(sd, i, 8, -3, 3), y + hr(sd, i, 9, -3, 3) - i * 0.3, 1, 0, i / 14, S, i, u);
        }
        lineFn(hx - Math.cos(ang) * 14 * k, hy - Math.sin(ang) * 14 * k, hx, hy, (q) => (q > 0.7 ? pal[4] : q > 0.3 ? pal[3] : on(hx + q * 9, hy, q * 2) ? pal[2] : null));
        shard(hx, hy, 6 * k, ang, pal);
        break;
      }
      case "wisp": case "skull": {
        // a smoky comet: shaded puffs that shrink and curl away behind a bright core
        const N = 16, span = 0.42;
        for (let i = N; i >= 1; i--) {
          const v = u - span * i / N;
          if (v < 0) continue;
          const [x, y, a] = path(v), age = i / N, w = Math.sin(i * 0.9 + u * 16) * 2.2 * k * age;
          blob(x - Math.sin(a) * w, y + Math.cos(a) * w - age * 3, (2.6 - age * 1.6) * k, [pal[0], pal[1], pal[2]], 1 - age * 0.85);
          if (i % 3 === 0) wisp(x + Math.sin(a) * w * 1.5, y - Math.cos(a) * w * 1.5 - age * 4, 1 + k * 0.5, a, pal, 1 - age, u * 12 + i);
        }
        blob(hx, hy, 2.8 * k, [pal[1], pal[2], pal[3]], 1);
        if (hd === "skull" && k > 0.8) {
          const z = k > 1.25 ? 2 : 1;
          bmp(BMP.skull, hx - 2.5 * z - 1, hy - 2.5 * z, pal[0], 1, null, z); bmp(BMP.skull, hx - 2.5 * z, hy - 2.5 * z - 1, pal[3], 1, null, z);
          Rt(hx - 1.5 * z, hy - 1, z, z, pal[0]); Rt(hx + 0.5 * z, hy - 1, z, z, pal[0]); P(hx - 2 * z, hy - 2 * z - 1, pal[4]);
        } else { for (let j = 0; j < 4; j++) { const a2 = ang + Math.PI + (j - 1.5) * 0.5; wisp(hx + Math.cos(a2) * 2, hy + Math.sin(a2) * 2, 1.2 + k * 0.6, a2 + Math.PI, pal, 1, u * 20 + j); } Rt(hx - 1, hy - 1, 2, 2, pal[4]); }
        break;
      }
      case "thorn": {
        for (let i = 0; i < 12; i++) {
          const v = u - i * 0.035;
          if (v < 0) break;
          const [x, y, a] = path(v), w = Math.sin(v * 26 + i * 0.3) * 3 * k;
          Pa(x - Math.sin(a) * w, y + Math.cos(a) * w, i % 2 ? X.S.acc || pal[1] : pal[1], 1 - i / 13);
          if (i % 3 === 1) leaf(x - Math.sin(a) * w * 1.4, y + Math.cos(a) * w * 1.4, a + v * 12, pal, 1 - i / 12, 0.8);
        }
        thorn(hx - Math.cos(ang) * 2, hy - Math.sin(ang) * 2, ang, [pal[0], S.acc || pal[1], pal[2], pal[3]], 1);
        thorn(hx, hy, ang, [pal[0], pal[1], pal[2], pal[4]], 1);
        break;
      }
      case "spit": {
        for (let i = 0; i < 5; i++) { const v = u - i * 0.035; if (v < 0) break; const [x, y] = path(v); blob(x, y, Math.max(0.6, (1.8 - i * 0.3) * k), [pal[1], pal[2], pal[3]], 1); }
        for (let i = 1; i < 6; i++) { const v = u - 0.08 - i * 0.07; if (v < 0) break; const [x, y] = path(v); drip(x, y + (u - v) * 30, 2, pal, 1 - i / 6); }
        Pa(hx - 1, hy - 1, pal[4], 1);
        break;
      }
      case "note": {
        halo(hx, hy, 4 * k, pal, 0.4);
        for (let i = 0; i < 4; i++) { const v = u - i * 0.08; if (v < 0) break; const [x, y] = path(v); part("note", x, y + Math.sin(v * 18 + i) * 3, i ? 1 : k * 1.2, 0, i * 0.12, S, i); }
        break;
      }
      case "coin": {
        for (let i = 0; i < 4; i++) { const v = u - i * 0.05; if (v < 0) break; const [x, y] = path(v); coin(x + (i % 2) * 2, y + (i % 2 ? 2 : -1), v * 30 + i, pal, 1, k); }
        for (let i = 1; i < 5; i++) { const v = u - i * 0.05; if (v < 0) break; const [x, y] = path(v); Pa(x, y - 2, pal[4], 1 - i / 5); }
        break;
      }
      case "facet": {
        // a prism: a bright diamond with a trail of chips flipping rose and mint
        for (let i = 1; i < 9; i++) { const v = u - i * 0.035; if (v < 0) break; const [x, y] = path(v); part("facet", x + hr(sd, i, 1, -2, 2), y + hr(sd, i, 2, -2, 2), 0.8, 0, i / 9, S, i, u); }
        const z = 3 * k;
        poly([[hx + Math.cos(ang) * z * 1.4, hy + Math.sin(ang) * z * 1.4], [hx - Math.sin(ang) * z, hy + Math.cos(ang) * z], [hx - Math.cos(ang) * z, hy - Math.sin(ang) * z], [hx + Math.sin(ang) * z, hy - Math.cos(ang) * z]], fl(u * 12) % 2 ? pal[2] : S.acc || pal[3], 1);
        Pa(hx, hy, pal[4], 1); Pa(hx - 1, hy - 1, pal[4], 1);
        break;
      }
      case "cog": {
        part("cog", hx, hy, 1.3 * k, 0, 0, S, 0, u);
        for (let i = 1; i < 6; i++) { const v = u - i * 0.04; if (v < 0) break; const [x, y] = path(v); Pa(x, y + i * 0.6, i % 2 ? pal[3] : pal[4], 1 - i / 6); }
        break;
      }
      case "bone": {
        bone(hx, hy, u * 30, pal, 1);
        for (let i = 1; i < 6; i++) { const v = u - i * 0.04; if (v < 0) break; const [x, y] = path(v); Pa(x, y, pal[2], 1 - i / 6); }
        break;
      }
      default: {
        lineFn(hx - Math.cos(ang) * 12 * k, hy - Math.sin(ang) * 12 * k, hx, hy, (q) => (q > 0.75 ? pal[4] : q > 0.4 ? pal[3] : on(hx + q * 7, hy, q * 1.6) ? pal[2] : null));
        Pa(hx, hy - 1, pal[4], 0.7); Pa(hx, hy + 1, pal[4], 0.7);
      }
    }
  }

  // ---------- choreography shared by the families ----------
  const tdir = (X, i) => { const q = X.tos[i] || X.tos[0]; return q.x === X.from.x ? X.dir : q.x > X.from.x ? 1 : -1; };
  const reachTo = (X, gap) => Math.max(0, Math.abs(X.tos[0].x - X.from.x) - gap * SCALE);
  function lunge(X, u, o, reach, back) {
    const T = X.T, w = T.windup, imp = T.impacts[0], d = X.dir;
    back = back === undefined ? 3 : back;
    if (u < w) { const q = eOut(u / w); o.dx = -d * back * q * SCALE; o.sx = 1 + 0.05 * q; o.sy = 1 - 0.07 * q; }
    else if (u < imp) { const q = sm(seg(u, w, imp - 0.06)); o.dx = d * lerp(-back * SCALE, reach, q); o.sx = q < 1 ? 1.12 : 1.04; o.sy = q < 1 ? 0.92 : 0.97; }
    else {
      const last = T.impacts[T.impacts.length - 1], q = sm(seg(u, last + 0.1, Math.max(last + 0.22, T.dur - 0.04)));
      o.dx = d * (reach + (u < imp + 0.06 ? 1.5 * SCALE : 0)) * (1 - q);
      if (u < imp + 0.08) { o.sx = 0.95; o.sy = 1.05; }
    }
  }
  function recoil(X, u, o, kick) {
    const w = X.T.windup, d = X.dir;
    if (u < w) { const q = eOut(u / w); o.dx = -d * 1.5 * q * SCALE; o.sy = 1 - 0.04 * q; o.dy = -q * 1; }
    else { const q = seg(u, w, w + 0.25); o.dx = -d * (1.5 + (kick || 2) * Math.sin(q * Math.PI)) * SCALE * (1 - q * 0.6) * (1 - seg(u, w + 0.25, w + 0.45)); }
  }
  function struck(X, u, i, o, power) {
    const ti = X.T.impacts[i] !== undefined ? X.T.impacts[i] : X.T.impacts[0], tt = u - ti;
    if (tt < 0) return;
    const d = tdir(X, i);
    if (X.P.miss) { const q = tt < 0.08 ? eOut(tt / 0.08) : 1 - sm(seg(tt, 0.2, 0.45)); o.dx = d * 6 * SCALE * q; o.dy = -2 * q; return; }
    const p = (power || 3) * (X.P.crit ? 1.7 : 1) * SCALE, q = tt < 0.06 ? eOut(tt / 0.06) : 1 - sm(seg(tt, 0.1, 0.5));
    o.dx = d * p * q;
    o.white = tt < 2.5 / 60 ? 1 : 0;
    if (tt < 0.1) { o.sx = 0.92; o.sy = 1.05; o.rot = d * 0.08 * (1 - tt / 0.1); }
  }
  const lastOf = (a) => a[a.length - 1];
  const byDist = (X, ox, oy, rate, t0) => X.tos.map((q) => t0 + Math.hypot(q.x - ox, (q.y - oy) / FLAT) / rate);
  const glowAt = (x, y, r, pal, a) => gdisc(x, y, r, pal[2], a * 0.5);

  // a crescent smear: the swing sweeps th0 -> th1 (radians, y down), drawn up to the head at progress q; fade dithers it out
  function crescent(cx, cy, R, ry, th0, th1, q, thick, pal, fade, tail) {
    if (q <= 0 || fade <= 0) return;
    const head = th0 + (th1 - th0) * Math.min(1, q), span = (th1 - th0) * (tail || 1), from = th0 + (th1 - th0) * Math.max(0, Math.min(1, q) - Math.abs(span / (th1 - th0)));
    const L = Math.abs(head - from) * R, n = Math.max(6, fl(L * 1.6));
    for (let i = 0; i <= n; i++) {
      const v = i / n, th = from + (head - from) * v, w = Math.max(1, thick * (0.2 + 0.8 * Math.pow(v, 0.8)) * (q > 1 ? 1 - (q - 1) * 0.6 : 1));
      const c = Math.cos(th), s = Math.sin(th), a = fade * (v < 0.25 ? 0.3 + v * 2.8 : 1);
      for (let r = 0; r < w; r++) {
        const rr = R - r, col = r === 0 ? (v > 0.75 ? pal[4] : pal[3]) : r < w * 0.45 ? (v > 0.85 ? pal[4] : pal[3]) : r < w - 1.5 ? pal[2] : r < w - 0.5 ? pal[1] : pal[0];
        Pa(cx + c * rr, cy + s * rr * ry, col, a);
      }
    }
  }
  const mir = (X, th) => (X.dir > 0 ? th : Math.PI - th);

  const FAM = {};

  // ===== slash: a crescent smear at the target =====
  FAM.slash = {
    shapes: ["arc", "cross", "wide", "flurry", "claw", "bite"], arc: 0.5,
    about: "melee cut: a crescent smear sweeps across the target, sparks at contact",
    count: (X) => (X.shape === "flurry" ? 3 : X.shape === "claw" ? 3 : 1),
    cuts(X) {
      const cs = [];
      if (X.shape === "flurry") for (let j = 0; j < X.n; j++) cs.push({ at: 0.27 + j * 0.09, ti: j % X.tos.length, j });
      else if (X.shape === "cross") X.tos.forEach((q, i) => { cs.push({ at: 0.27 + i * 0.05, ti: i, j: 0 }); cs.push({ at: 0.36 + i * 0.05, ti: i, j: 1 }); });
      else if (X.shape === "wide") {
        const xs = X.tos.map((q) => q.x * X.dir), lo = Math.min(...xs), hi = Math.max(...xs);
        X.tos.forEach((q, i) => cs.push({ at: 0.27 + (hi > lo ? (q.x * X.dir - lo) / (hi - lo) : 0) * 0.08, ti: i, j: 0 }));
      } else X.tos.forEach((q, i) => cs.push({ at: 0.3 + i * 0.05, ti: i, j: 0 }));
      return cs;
    },
    time(X) {
      const cs = this.cuts(X), imp = X.tos.map((q, i) => { const m = cs.filter((c) => c.ti === i).map((c) => c.at); return m.length ? Math.max(...m.slice(0, X.shape === "cross" ? 2 : 1)) : 0.3; });
      return { windup: 0.16, impacts: imp, dur: Math.max(...cs.map((c) => c.at)) + 0.4, cuts: cs };
    },
    draw(X, u, layer) {
      if (layer !== "fx") return;
      const k = X.k, pal = X.pal, miss = X.P.miss;
      if (X.shape === "wide") {
        const xs = X.tos.map((q) => q.x), span = Math.max(...xs) - Math.min(...xs), cx = (Math.max(...xs) + Math.min(...xs)) / 2 - X.dir * 4 * k;
        const cy = X.dst.reduce((m, q) => m + q.y, 0) / X.dst.length + (miss ? -8 : 0), R = span / 2 + 13 * k;
        const q = seg(u, 0.18, 0.37) * 1.05, fade = 1 - seg(u, 0.4, 0.62);
        crescent(cx, cy, R, 0.42, mir(X, Math.PI * 1.15), mir(X, -0.15 * Math.PI + X.arc * 0.4), q, 6 * k, pal, fade);
        crescent(cx, cy + 2, R - 3 * k, 0.42, mir(X, Math.PI * 1.1), mir(X, -0.1 * Math.PI), seg(u, 0.2, 0.39), 1.5 * k, [pal[0], pal[1], pal[2], pal[2], pal[3]], fade * 0.7);
      }
      for (const c of X.T.cuts) {
        const d = X.dst[c.ti], q = seg(u, c.at - 0.075, c.at + 0.015) * 1.06, fade = 1 - seg(u, c.at + 0.08, c.at + 0.3);
        const tilt = hr(X.seed, c.j + c.ti * 7, 1, -0.35, 0.35), dy = miss ? -9 * k : 0;
        if (X.shape === "arc" || X.shape === "flurry" || X.shape === "cross") {
          const small = X.shape === "flurry" ? 0.75 : 1, R = 15 * k * small, sw = (0.65 + X.arc * 0.55) * Math.PI;
          const up = X.shape === "cross" ? c.j === 1 : X.shape === "flurry" ? c.j % 2 === 1 : hs(X.seed, 3, 3) < 0.25;
          const th0 = up ? 0.55 * Math.PI + tilt : -0.6 * Math.PI + tilt, th1 = up ? th0 - sw * 0.9 : th0 + sw * 0.85;
          const ox = d.x - X.dir * (up ? 2 : 5) * k * small, oy = d.y + dy + (X.shape === "flurry" ? hr(X.seed, c.j, 4, -4, 4) * k : 0);
          crescent(ox, oy, R, 0.8, mir(X, th0), mir(X, th1), q, 5.5 * k * small, pal, fade);
        } else if (X.shape === "claw") {
          const cf = 1 - seg(u, c.at + 0.12, c.at + 0.4);
          for (let m = 0; m < 3; m++) {
            const off = (m - 1) * 4.5 * k, L = 22 * k, ang = mir(X, 0.33 * Math.PI + tilt * 0.5), ca = Math.cos(ang), sa = Math.sin(ang);
            const x0 = d.x - ca * L / 2 - sa * off, y0 = d.y + dy - sa * L / 2 + ca * off, qq = clamp(seg(u, c.at - 0.07 + m * 0.02, c.at + m * 0.02), 0, 1);
            if (qq <= 0 || cf <= 0) continue;
            const mid = (v) => Math.sin(v * Math.PI);
            for (let j = 0; j <= L * qq; j++) {
              const v = j / (L * qq), px = x0 + ca * j, py = y0 + sa * j, w = mid(v) * 1.6 * k;
              if (!on(px, py, cf * (0.4 + v))) continue;
              P(px - sa * (w + 1), py + ca * (w + 1), pal[0]); P(px + sa * (w + 1), py - ca * (w + 1), pal[0]);
              for (let r = -fl(w); r <= fl(w); r++) P(px - sa * r, py + ca * r, r === 0 ? "#ffffff" : pal[3]);
            }
          }
        } else if (X.shape === "bite") {
          const gap = 13 * k * (1 - eIn(seg(u, c.at - 0.07, c.at))) + 1, open = u < c.at + 0.16 ? 1 : 1 - seg(u, c.at + 0.16, c.at + 0.32);
          if (open > 0 && u > c.at - 0.08) {
            const w = 16 * k, x0 = d.x - w / 2, Tc = ["#fff8e8", "#e8dcc0"], yU = d.y + dy - gap, yL = d.y + dy + gap, th = 5 * k;
            Rt(x0 - 3, yU - 3, w + 6, 3, pal[0]); Rt(x0 - 2, yU - 2, w + 4, 1, pal[1]);
            Rt(x0 - 3, yL, w + 6, 3, pal[0]); Rt(x0 - 2, yL + 1, w + 4, 1, pal[1]);
            for (let m = 0; m < 5; m++) {
              const tx = x0 + m * w / 4.4;
              poly([[tx - 1.8 * k - 1, yU - 1], [tx + 1.8 * k + 1, yU - 1], [tx, yU + th + 1]], pal[0], open);
              poly([[tx - 1.8 * k, yU], [tx + 1.8 * k, yU], [tx, yU + th]], Tc[0], open);
              const bx = tx + w / 8.8;
              poly([[bx - 1.8 * k - 1, yL + 1], [bx + 1.8 * k + 1, yL + 1], [bx, yL - th - 1]], pal[0], open);
              poly([[bx - 1.8 * k, yL], [bx + 1.8 * k, yL], [bx, yL - th]], Tc[1], open);
            }
          }
        }
        if (!miss) burst(X, d.x - X.dir * 2, d.y, u - c.at, X.dir, X.shape === "flurry" ? 0.7 : 1);
        else if (u > c.at && u < c.at + 0.25) for (let m = 0; m < 3; m++) line(d.x + X.dir * (4 + m * 3), d.y - 10 * k - m * 2, d.x + X.dir * (10 + m * 3), d.y - 10 * k - m * 2, pal[3], 1 - seg(u, c.at, c.at + 0.25));
      }
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { lunge(X, u, o, reachTo(X, X.shape === "wide" ? 20 : 16)); if (X.shape === "flurry" && u > X.T.windup) o.dy = -Math.abs(Math.sin(u * 30)) * 1.5; }
      else struck(X, u, i, o, X.shape === "wide" ? 4 : 3);
    },
    marks(X) {
      if (X.P.miss) return [];
      const S = X.S, m = [];
      X.tos.forEach((q, i) => { if (X.P.crit || (S.decal && S.decal !== "cut" && S.decal !== "stub" && S.decal !== "scuff")) m.push({ kind: S.decal && S.decal !== "stub" ? S.decal : "cut", x: q.x + tdir(X, i) * 2, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.7 * X.P.size, seed: X.seed + i, school: S.id } }); });
      if (X.shape === "wide") m.push({ kind: "scuff", x: X.from.x + X.dir * 8, y: X.from.y, at: X.T.impacts[0], opts: { size: 0.8, seed: X.seed } });
      return m;
    },
  };

  // ===== thrust: a streak through the target =====
  FAM.thrust = {
    shapes: ["stab", "rapier", "pierce", "lance"], arc: 0,
    about: "a straight streak through the target, a glint on the tip, a shock ring where it lands",
    count: (X) => (X.shape === "rapier" ? 2 : 1),
    time(X) {
      if (X.shape === "pierce") { const ts = byDist(X, X.from.x, X.from.y, 600, 0.3); return { windup: 0.2, impacts: ts, dur: Math.max(...ts) + 0.34 }; }
      if (X.shape === "rapier") { const imps = X.tos.map((q, i) => 0.26 + i * 0.06); return { windup: 0.16, impacts: imps, dur: 0.26 + (X.n - 1) * 0.11 + X.tos.length * 0.06 + 0.3, jabs: X.n }; }
      if (X.shape === "lance") return { windup: 0.28, impacts: X.tos.map((q, i) => 0.42 + i * 0.05), dur: 0.95 };
      return { windup: 0.2, impacts: X.tos.map((q, i) => 0.3 + i * 0.05), dur: 0.64 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, d0 = X.dst[0], last = X.dst.reduce((m, q) => (Math.abs(q.x - X.from.x) > Math.abs(m.x - X.from.x) ? q : m), d0);
      if (layer === "floor") {
        if (X.shape === "lance" && u > X.T.windup && u < X.T.impacts[0] + 0.1) for (let j = 0; j < 3; j++) line(X.from.x - X.dir * (6 + j * 7), X.from.y - j, X.from.x - X.dir * (14 + j * 9), X.from.y - j, DUST[2], 0.6);
        return;
      }
      const thick = X.shape === "lance" ? 3 : X.shape === "rapier" ? 1 : X.shape === "pierce" ? 3 : 2;
      const jabs = X.shape === "rapier" ? X.n : 1;
      for (let j = 0; j < jabs; j++) {
        const imp = X.T.impacts[0] + j * 0.11, st = imp - (X.shape === "lance" ? 0.14 : 0.1);
        const end = X.shape === "pierce" ? last.x + X.dir * 16 * k : d0.x + X.dir * 9 * k, y = (X.shape === "pierce" ? (d0.y + last.y) / 2 : d0.y) + (j % 2 ? -3 : 0) * k + (X.P.miss ? -7 : 0);
        const x0 = X.from.x + X.dir * 6 * SCALE + X.dir * (X.shape === "lance" ? 0 : reachTo(X, 22)), head = lerp(x0, end, eOut(seg(u, st, imp + (X.shape === "pierce" ? Math.max(0, lastOf(X.T.impacts) - imp) : 0))));
        const tail = lerp(x0, head, eIn(seg(u, imp, imp + 0.18)));
        if (u < st || u > imp + 0.2) continue;
        for (let r = -thick; r <= thick; r++) {
          const col = r === 0 ? pal[4] : Math.abs(r) === 1 && thick > 1 ? pal[3] : Math.abs(r) === thick ? pal[1] : pal[2];
          lineFn(tail, y + r, head, y + r, (v) => (on(tail + (head - tail) * v, y + r, (Math.abs(r) === thick ? 0.5 : 1) * (0.25 + v)) ? (v > 0.92 ? pal[4] : col) : null));
        }
        poly([[head + X.dir * 4 * k, y], [head, y - 1.6 * k], [head - X.dir * 2, y], [head, y + 1.6 * k]], pal[3], 1 - seg(u, imp + 0.06, imp + 0.2));
        if (X.shape === "lance" || thick > 1) for (let m = 0; m < 3; m++) { const ly = y + (m - 1) * 5 * k, lx = tail - X.dir * (4 + m * 6); line(lx, ly, lx - X.dir * 10 * k, ly, pal[3], 0.6 * (1 - seg(u, imp, imp + 0.2))); }
      }
      X.dst.forEach((d, i) => {
        const tt = u - X.T.impacts[i];
        if (X.P.miss || tt < 0) return;
        if (tt < 0.12) star(d.x + X.dir * 5 * k, d.y, (tt < 0.05 ? 5 : 3) * k, [pal[1], pal[2], pal[3], pal[4], "#ffffff"], 1);
        if (tt < 0.22) { const rr = (2 + tt * 40) * k; for (let a = 0; a < 16; a++) { const th = a / 16 * TAU; Pa(d.x + Math.cos(th) * rr * 0.35, d.y + Math.sin(th) * rr, pal[3], 1 - tt / 0.22); } }
        burst(X, d.x, d.y, tt, X.dir, X.shape === "lance" ? 1.4 : X.shape === "rapier" ? 0.6 : 0.9);
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") lunge(X, u, o, X.shape === "lance" ? reachTo(X, 14) : reachTo(X, 22) * 0.5, X.shape === "lance" ? 5 : 3);
      else struck(X, u, i, o, X.shape === "lance" ? 7 : 3);
    },
    marks(X) {
      const m = [];
      if (X.shape === "lance") m.push({ kind: "skid", x: X.from.x + X.dir * reachTo(X, 14) * 0.5, y: X.from.y, at: X.T.impacts[0], opts: { size: reachTo(X, 14) / 24 + 0.5, flip: X.dir < 0 } });
      if (!X.P.miss && X.S.decal && !["cut", "stub", "scuff", "skid"].includes(X.S.decal)) X.tos.forEach((q, i) => m.push({ kind: X.S.decal, x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.6, seed: X.seed + i, school: X.S.id } }));
      return m;
    },
  };

  // ===== smash: overhead blows, stomps, bashes and fissures =====
  function spike(x, y, h, X, a, w) {
    const pal = X.pal, id = X.S.id;
    if (h < 1) return;
    w = (w || 2.4) * X.k;
    if (id === "flame" || id === "hearth") { tongue(x, y - h * 0.4, Math.min(4, h * 0.35), -Math.PI / 2, 0.9, pal, a); tongue(x + 1, y - h * 0.15, Math.min(3, h * 0.25), -Math.PI / 2, 0.6, pal, a); return; }
    if (id === "frost") { shard(x, y, h * 0.9, -Math.PI / 2 + 0.1, pal, a); return; }
    if (id === "wild") {
      for (let j = 0; j < h; j++) { const t = 1 - j / h, wv = Math.sin(j * 0.45) * 1.6 * t; Pa(x + wv - 1, y - j, pal[0], a); Pa(x + wv, y - j, j > h - 2 ? pal[3] : pal[1], a); if (t > 0.35) Pa(x + wv + 1, y - j, pal[2], a); }
      thorn(x + 1, y - h * 0.45, -0.3, pal, a); thorn(x - 1, y - h * 0.7, Math.PI + 0.3, pal, a); leaf(x + 2, y - h, -1.1, pal, a, 0.9);
      return;
    }
    if (id === "death" || id === "bone") {
      // a curved bone fang: dark rim, lit flank, a knuckle at the base
      const c = SCHOOLS.bone.pal, bw = Math.max(1.5, w * 0.6), lean = (fl(x) % 2 ? 1 : -1) * h * 0.18;
      poly([[x - bw - 1, y + 1], [x + lean, y - h - 1], [x + bw + 1, y + 1]], c[0], a);
      poly([[x - bw, y], [x + lean, y - h], [x + bw, y]], c[2], a);
      line(x - bw * 0.4, y - 1, x + lean, y - h + 1, c[3], a);
      Pa(x + lean, y - h, c[4], a); Rt(x - bw - 1, y - 1, bw * 2 + 3, 2, c[1]);
      if (id === "death") Pa(x + 1, y - h * 0.5, X.pal[3], a);
      return;
    }
    if (id === "storm") { fork(x, y, x + hr(X.seed, fl(x), 1, -3, 3), y - h, X.seed + fl(x) + fl(a * 4), pal, a, false, 0); return; }
    if (id === "holy" || id === "arcane" || id === "healing" || id === "lore") { line(x, y, x, y - h, pal[3], a); line(x + 1, y, x + 1, y - h * 0.7, pal[2], a); Pa(x, y - h, pal[4], a); return; }
    const c = STONE;
    poly([[x - w - 1, y + 1], [x + w * 0.2, y - h - 1], [x + w + 1, y + 1]], c[0], a);
    poly([[x - w, y], [x + w * 0.2, y - h], [x + w, y]], c[1], a);
    line(x + w * 0.2, y - h, x - w * 0.6, y - 1, c[3], a);
    Pa(x + w * 0.2, y - h, c[3], a);
  }
  FAM.smash = {
    shapes: ["hammer", "stomp", "slam", "quake"], arc: 0.5,
    about: "an overhead blow or a stamp: shockwave ring, dust, flying chips, a crack left in the floor",
    time(X) {
      if (X.shape === "stomp") { const ts = byDist(X, X.from.x, X.from.y, 320, 0.45); return { windup: 0.3, impacts: ts, dur: Math.max(...ts) + 0.55 }; }
      if (X.shape === "quake") { const ts = byDist(X, X.from.x, X.from.y, 260, 0.42); return { windup: 0.28, impacts: ts, dur: Math.max(...ts) + 0.55 }; }
      if (X.shape === "slam") return { windup: 0.24, impacts: X.tos.map((q, i) => 0.36 + i * 0.05), dur: 0.9 };
      return { windup: 0.32, impacts: X.tos.map((q, i) => 0.45 + i * 0.05), dur: 1.0 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, imp = X.T.impacts[0];
      if (X.shape === "quake") {
        X.tos.forEach((q, i) => {
          const ti = X.T.impacts[i], st = X.T.windup, prog = seg(u, st, ti), fade = 1 - seg(u, ti + 0.25, X.T.dur);
          const x0 = X.from.x + X.dir * 6, y0 = X.from.y, x1 = q.x, y1 = q.y, n = Math.max(2, fl(Math.abs(x1 - x0) / 7));
          if (layer === "floor" && prog > 0) {
            let px = x0, py = y0;
            for (let j = 1; j <= n * prog; j++) { const v = j / n, nx = lerp(x0, x1, v) + hr(X.seed + i, j, 1, -1, 1), ny = lerp(y0, y1, v) + hr(X.seed + i, j, 2, -1.5, 1.5); line(px, py, nx, ny, STONE[0], fade); line(px, py + 1, nx, ny + 1, X.S.id === "flame" ? pal[2] : STONE[3], fade * 0.6); px = nx; py = ny; }
          }
          if (layer === "fx") for (let j = 1; j <= n; j++) {
            const v = j / n, at = lerp(st, ti, v), tt = u - at;
            if (tt < 0 || tt > 0.4) continue;
            const h = (j === n ? 12 : 6) * k * Math.sin(Math.min(1, tt / 0.3) * Math.PI) * (0.7 + hs(X.seed, j, 4) * 0.5);
            spike(lerp(x0, x1, v), lerp(y0, y1, v), h, X, 1, j === n ? 3.2 : 2);
          }
        });
      }
      if (layer === "floor") {
        X.tos.forEach((q, i) => {
          const tt = u - X.T.impacts[i];
          if (tt > 0 && tt < 0.35 && X.shape !== "stomp" && !X.P.miss) gring(q.x, q.y, (5 + tt * 90) * k, tt < 0.1 ? pal[4] : pal[3], 1 - tt / 0.35, 2, 0);
        });
        if (X.shape === "stomp") {
          const tt = u - imp, R = X.area || 34 * k;
          if (tt > 0 && tt < 0.5) { gring(X.from.x, X.from.y, R * eOut(tt / 0.4), pal[3], 1 - tt / 0.5, 2, 0); gring(X.from.x, X.from.y, R * eOut(tt / 0.4) - 4, DUST[1], 0.6 * (1 - tt / 0.5), 1, 0); }
        }
        return;
      }
      if (X.shape === "hammer" && u < imp + 0.08 && u > X.T.windup - 0.05) {
        const d = X.dst[0], cx = d.x - X.dir * 9 * k, cy = d.y + 7 * k, q = seg(u, X.T.windup - 0.02, imp + 0.01) * 1.04;
        crescent(cx, cy, 17 * k, 1, mir(X, -0.95 * Math.PI), mir(X, -0.12 * Math.PI + X.arc * 0.2), q, 4 * k, pal, 1 - seg(u, imp, imp + 0.08));
      }
      if (X.shape === "slam") X.dst.forEach((d, i) => {
        const tt = u - X.T.impacts[i];
        if (tt < 0 || tt > 0.26 || X.P.miss) return;
        const f = 1 - tt / 0.26, push = eOut(Math.min(1, tt / 0.15)) * 8 * k;
        for (let m = -3; m <= 3; m++) {
          const L = (16 - Math.abs(m) * 2.5) * k * (0.6 + 0.4 * f), x0 = d.x + X.dir * (2 + push * 0.5), yy = d.y + m * 2.6 * k;
          line(x0, yy + 1, x0 + X.dir * L, yy + 1, pal[1], f); line(x0, yy, x0 + X.dir * L, yy, m === 0 ? pal[4] : pal[3], f);
        }
        if (tt < 0.1) { halo(d.x, d.y, 9 * k, pal, 0.8 * (1 - tt / 0.1)); star(d.x - X.dir * 2, d.y, 9 * k * (1 - tt / 0.2), IMPACT, 1); }
      });
      const centres = X.shape === "stomp" ? [{ x: X.from.x, y: X.from.y, at: imp }] : X.tos.map((q, i) => ({ x: q.x, y: q.y, at: X.T.impacts[i] }));
      centres.forEach((c, ci) => {
        const tt = u - c.at;
        if (tt < 0 || tt > 0.7 || X.P.miss) return;
        const R = X.shape === "stomp" ? X.area || 34 * k : 14 * k;
        for (let j = 0; j < 10; j++) {
          const ang = (j / 10) * TAU + hs(X.seed, j, 5), dist = R * eOut(Math.min(1, tt / 0.45)) * hr(X.seed, j + ci, 6, 0.55, 1), life = tt / hr(X.seed, j, 7, 0.45, 0.7);
          part("dust", c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist * FLAT - tt * 8, k * 0.9, 0, life, X.S, j);
        }
        for (let j = 0; j < 7; j++) {
          const v = hr(X.seed, j + ci * 9, 8, 50, 110) * k, ang = -Math.PI / 2 + hr(X.seed, j, 9, -1.1, 1.1), life = tt / 0.55;
          if (life >= 1) continue;
          const px = c.x + Math.cos(ang) * v * tt, py = c.y - 2 + Math.sin(ang) * v * tt + 300 * tt * tt;
          if (py > c.y + 2) continue;
          P(px, py, j % 2 ? STONE[2] : STONE[1]); if (j % 3 === 0) P(px + 1, py, STONE[3]);
        }
        if (X.S.id === "fury") for (let j = 0; j < 6; j++) part("streak", c.x + (j - 2.5) * 4 * k, c.y - tt * 70 * hr(X.seed, j, 10, 0.6, 1) - 4, k, -Math.PI / 2, tt / 0.5, X.S, j);
        else if (X.S.id !== "physical" && X.S.id !== "blade" && X.S.id !== "shield" && X.S.id !== "road" && X.S.id !== "beast")
          for (let j = 0; j < 6; j++) { const ang = j / 6 * TAU, rr = R * 0.7 * eOut(Math.min(1, tt / 0.3)); spike(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr * FLAT, 7 * k * Math.sin(Math.min(1, tt / 0.45) * Math.PI), X, 1); }
      });
      X.dst.forEach((d, i) => { if (!X.P.miss) burst(X, d.x, d.y - (X.shape === "hammer" ? 4 : 0), u - X.T.impacts[i], X.dir, X.shape === "stomp" ? 0.7 : 1.1); });
    },
    pose(X, role, u, i, o) {
      const imp = X.T.impacts[0], w = X.T.windup;
      if (role === "actor") {
        if (X.shape === "stomp" || X.shape === "quake") {
          if (u < w) { const q = eOut(u / w); o.sy = 1 - 0.1 * q; o.sx = 1 + 0.06 * q; }
          else if (u < imp) { const q = seg(u, w, imp); o.dy = -10 * SCALE * Math.sin(q * Math.PI * 0.9); o.sy = 1.08; o.sx = 0.94; }
          else { const q = seg(u, imp, imp + 0.16); o.sy = 1 - 0.14 * (1 - q); o.sx = 1 + 0.1 * (1 - q); }
          return;
        }
        lunge(X, u, o, reachTo(X, X.shape === "slam" ? 18 : 16), 4);
        if (X.shape === "hammer" && u > w && u < imp) o.dy = -7 * SCALE * Math.sin(seg(u, w, imp) * Math.PI);
        if (X.shape === "hammer" && u >= imp && u < imp + 0.12) { o.sy = 0.86; o.sx = 1.1; }
      } else {
        struck(X, u, i, o, X.shape === "slam" ? 9 : 4);
        const tt = u - (X.T.impacts[i] || imp);
        if (!X.P.miss && tt > 0 && tt < 0.14 && X.shape !== "slam") { o.sy = 0.84; o.sx = 1.1; }
      }
    },
    marks(X) {
      if (X.P.miss) return [];
      const m = [], sd = X.S.decal, special = sd && !["cut", "stub", "scuff", "skid", "gouge"].includes(sd);
      if (X.shape === "stomp") {
        m.push({ kind: "crack", x: X.from.x, y: X.from.y + 1, at: X.T.impacts[0] - 0.02, opts: { size: X.P.size, seed: X.seed } });
        m.push({ kind: "scuff", x: X.from.x, y: X.from.y, at: X.T.impacts[0], opts: { size: (X.area || 34 * X.k) / 22, seed: X.seed } });
      } else if (X.shape === "quake") X.tos.forEach((q, i) => m.push({ kind: "crack", x: X.from.x + X.dir * 6, y: X.from.y, at: X.T.impacts[i], opts: { to: [q.x, q.y], seed: X.seed + i } }));
      else if (X.shape === "slam") X.tos.forEach((q, i) => m.push({ kind: "skid", x: q.x, y: q.y, at: X.T.impacts[i], opts: { size: 0.7 * (X.P.crit ? 1.6 : 1), flip: tdir(X, i) < 0 } }));
      else X.tos.forEach((q, i) => m.push({ kind: "crack", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.8 * X.P.size * (X.P.crit ? 1.3 : 1), seed: X.seed + i } }));
      if (special) X.tos.forEach((q, i) => m.push({ kind: sd, x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.8, seed: X.seed + i, school: X.S.id } }));
      return m;
    },
  };

  // ===== arrow: physical missiles =====
  const WOOD = ["#3a2412", "#7a5230", "#a87a48"], STEEL = ["#4a5260", "#c8d0dc", "#ffffff"];
  function arrowSprite(x, y, ang, X, len, heavy) {
    const c = Math.cos(ang), s = Math.sin(ang), L = len * SCALE;
    lineFn(x - c * L, y - s * L, x, y, (v) => (v > 0.8 ? STEEL[1] : v < 0.22 ? (fl(v * 20) % 2 ? "#f4ecdc" : X.S.id === "marksman" || X.S.id === "physical" ? "#c84a3a" : X.pal[2]) : WOOD[1]));
    if (heavy) lineFn(x - c * L + s, y - s * L - c, x + s, y - c, (v) => (v > 0.75 ? STEEL[0] : WOOD[0]));
    P(x, y, STEEL[2]);
    for (let f = 0; f < 3; f++) { const fx = x - c * L * (0.98 - f * 0.08), fy = y - s * L * (0.98 - f * 0.08); P(fx - s * 1.3, fy + c * 1.3, f % 2 ? "#e8dcc4" : "#f4ecdc"); P(fx + s * 1.3, fy - c * 1.3, "#d8ccb4"); }
    P(x - c, y - s, STEEL[1]); P(x - c * 1.5 + s, y - s * 1.5 - c, STEEL[0]); P(x - c * 1.5 - s, y - s * 1.5 + c, STEEL[0]);
  }
  function thrown(x, y, ph, X) {
    const c = Math.cos(ph), s = Math.sin(ph);
    line(x - c * 3, y - s * 3, x + c * 1, y + s * 1, STEEL[1]); P(x + c * 3, y + s * 3, WOOD[1]); P(x + c * 2, y + s * 2, WOOD[0]); P(x - c * 3, y - s * 3, STEEL[2]);
  }
  const SCHOOL_TRAIL = { flame: "tongue", hearth: "ember", frost: "flake", storm: "spark", poison: "drip", water: "drip", holy: "mote", healing: "mote",
    shadow: "wisp", death: "wisp", arcane: "rune", lore: "rune", wild: "leaf", fury: "streak", song: "note", trade: "glint", craft: "spark", bone: "dust" };
  FAM.arrow = {
    shapes: ["arrow", "volley", "bolt", "sling", "throw"], arc: 0.15,
    about: "arrows, quarrels, stones and knives: a real arrow on a shallow lob that sticks, a school trail if enchanted",
    count: (X) => (X.shape === "volley" ? Math.max(5, X.tos.length * 2) : 1),
    shots(X) {
      const out = [], vol = X.shape === "volley", fast = X.shape === "bolt" ? 1.7 : X.shape === "throw" ? 0.85 : 1;
      const N = vol ? X.n : X.tos.length;
      for (let j = 0; j < N; j++) {
        const ti = j % X.tos.length, q = X.tos[ti], stray = vol && j >= X.tos.length;
        const tx = stray ? q.x + hr(X.seed, j, 1, -16, 16) * X.k : q.x, ty = stray ? q.y + hr(X.seed, j, 2, -5, 5) : q.y;
        const dist = Math.abs(tx - X.src.x), launch = (vol ? 0.14 + j * 0.045 : 0.15 + j * 0.05);
        const fly = clamp(dist / (320 * fast), 0.12, 0.55) * (vol ? 1.5 : 1);
        const miss = X.P.miss && !stray;
        out.push({ j, ti, stray, miss, launch, fly, at: launch + fly, x1: miss || stray ? tx + X.dir * (miss ? 12 : 0) * X.k : tx, y1: stray || miss ? ty - 1 : chest(q).y + hr(X.seed, j, 3, -3, 2) });
      }
      return out;
    },
    time(X) {
      const sh = this.shots(X), imp = X.tos.map((q, i) => { const s = sh.find((z) => z.ti === i && !z.stray); return s ? s.at : sh[0].at; });
      return { windup: 0.15, impacts: imp, dur: Math.max(...sh.map((s) => s.at)) + 0.4, shots: sh };
    },
    draw(X, u, layer) {
      const k = X.k, trail = SCHOOL_TRAIL[X.S.id];
      for (const s of X.T.shots) {
        const v = seg(u, s.launch, s.at), h = (X.shape === "volley" ? 0.55 + X.arc * 0.4 : X.shape === "bolt" ? X.arc * 0.15 : X.shape === "sling" ? 0.25 + X.arc : X.arc) * Math.abs(s.x1 - X.src.x) * 0.5 + 2;
        const path = (w) => lob(X.src.x, X.src.y, s.x1, s.y1, h, w);
        if (layer === "floor") {
          if (u > s.launch && u < s.at && h > 10) { const gx = lerp(X.from.x, s.x1, v), gy = lerp(X.from.y, s.stray || s.miss ? s.y1 + 1 : X.tos[s.ti].y, v); Pa(gx, gy, "#00000060", 1); line(gx - 1, gy, gx + 1, gy, "rgba(0,0,0,0.25)", 1); }
          continue;
        }
        if (u < s.launch) continue;
        if (u < s.at) {
          const [x, y, ang] = path(v);
          if (trail) for (let m = 1; m <= 5; m++) { const w = v - m * 0.05; if (w < 0) break; const [tx, ty, ta] = path(w); part(trail, tx, ty, 0.6 * k, ta, m / 6, X.S, m + s.j, u); }
          for (let m = 1; m <= 6; m++) { const w = v - m * 0.025; if (w < 0) break; const [tx, ty] = path(w); Pa(tx, ty, "#fffaf0", 0.8 - m * 0.12); }
          if (X.shape === "sling") { Rt(x - 1, y - 1, 2, 2, STONE[1]); P(x - 1, y - 1, STONE[3]); }
          else if (X.shape === "throw") thrown(x, y, u * 34 * X.dir, X);
          else arrowSprite(x, y, ang, X, X.shape === "bolt" ? 8 : 10, X.shape === "bolt");
        } else {
          const tt = u - s.at, ang = path(0.999)[2];
          if (X.shape !== "sling" && X.shape !== "throw" && tt < 0.35 && !s.stray && !s.miss) {
            const sx = s.x1 - Math.cos(ang) * 2, sy = s.y1 - Math.sin(ang) * 2 + (tt > 0.04 ? 0 : 0);
            arrowSprite(sx + Math.sin(tt * 60) * (1 - tt / 0.35), sy, ang + Math.sin(tt * 50) * 0.15 * (1 - tt / 0.35), X, 7, false);
          }
          if (!s.stray && !s.miss) burst(X, s.x1, s.y1, tt, X.dir, X.shape === "bolt" ? 1.25 : X.shape === "volley" ? 0.6 : 0.85, X.shape === "sling" ? "spark" : trail && X.S.burst !== "spark" ? X.S.burst : "spark");
          else if (tt < 0.25) part("dust", s.x1, s.y1, 0.6 * k, 0, tt / 0.25, X.S, s.j);
        }
      }
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { recoil(X, u, o, X.shape === "bolt" ? 3 : 1.5); if (u < X.T.windup) o.sx = 1 - 0.05 * eOut(u / X.T.windup); }
      else struck(X, u, i, o, X.shape === "bolt" ? 5 : X.shape === "sling" ? 2 : 3);
    },
    marks(X) {
      const m = [];
      for (const s of X.T.shots) if ((s.stray || s.miss) && X.shape !== "sling") m.push({ kind: "stub", x: s.x1, y: s.y1 + 1, at: s.at, opts: { flip: X.dir < 0, seed: X.seed + s.j } });
      if (X.S.decal && !["stub", "cut", "skid", "scuff", "gouge"].includes(X.S.decal)) X.T.shots.filter((s) => !s.stray && !s.miss).forEach((s) => m.push({ kind: X.S.decal, x: X.tos[s.ti].x, y: X.tos[s.ti].y + 1, at: s.at, opts: { size: 0.45, seed: X.seed + s.j, school: X.S.id } }));
      return m;
    },
  };

  // ===== bolt: shaped spell projectiles =====
  function charge(X, u, layer, t0, t1, col) {
    if (u < t0 || u > t1 + 0.06) return;
    const q = seg(u, t0, t1), k = X.k, s = X.src;
    if (layer === "floor") { glowAt(X.from.x, X.from.y, (6 + 6 * q) * k, X.pal, 0.5 + 0.3 * Math.sin(u * 30)); return; }
    const kind = X.S.p === "tongue" ? "ember" : X.S.p === "fork" ? "spark" : X.S.p === "streak" ? "spark" : X.S.p;
    for (let j = 0; j < 8; j++) {
      const ph = (q + j / 8) % 1, r = (14 - 12 * ph) * k, ang = j * 2.4 + u * 6;
      part(kind, s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r * 0.7, 0.7 * k, ang + Math.PI, ph > 0.85 ? (ph - 0.85) * 6 : 0, X.S, j, u);
    }
    if (u > t1 - 0.04) star(s.x, s.y, 4 * k, X.pal, 1 - seg(u, t1, t1 + 0.06));
  }
  FAM.bolt = {
    shapes: ["missile", "lance", "lob", "strike", "drain", "swarm"], arc: 0.12,
    about: "a spell flies: flame tongues, an ice shard, a crackling spark, runes, a wisp, a skull, a thorn... never a ball",
    count: (X) => (X.shape === "swarm" ? 5 : 1),
    shots(X) {
      const out = [], N = X.shape === "swarm" ? Math.max(X.n, X.tos.length) : X.tos.length, fast = X.shape === "lance" ? 1.9 : X.shape === "lob" ? 0.8 : X.shape === "swarm" ? 1.1 : 1;
      for (let j = 0; j < N; j++) {
        const ti = j % X.tos.length, d = X.dst[ti], dist = Math.hypot(d.x - X.src.x, d.y - X.src.y);
        const launch = 0.3 + j * (X.shape === "swarm" ? 0.055 : 0.07), fly = clamp(dist / (300 * fast), 0.12, 0.5);
        const ox = X.P.miss ? X.dir * 14 * X.k : 0, oy = X.P.miss ? -10 : hr(X.seed, j, 1, -2, 2);
        out.push({ j, ti, launch, at: launch + fly, x1: d.x + ox, y1: d.y + oy, bend: X.shape === "swarm" ? hr(X.seed, j, 2, -1, 1) * 30 * X.k : 0 });
      }
      return out;
    },
    time(X) {
      if (X.shape === "strike") return { windup: 0.3, impacts: X.tos.map((q, i) => 0.45 + i * 0.07), dur: 0.45 + X.tos.length * 0.07 + 0.55 };
      if (X.shape === "drain") return { windup: 0.28, impacts: X.tos.map((q, i) => 0.34 + i * 0.05), dur: 1.25 };
      const sh = this.shots(X), imp = X.tos.map((q, i) => sh.find((s) => s.ti === i).at);
      return { windup: 0.3, impacts: imp, dur: Math.max(...sh.map((s) => s.at)) + 0.5, shots: sh };
    },
    path(X, s) {
      const h = (X.shape === "lob" ? 0.5 + X.arc * 0.5 : X.shape === "lance" ? 0 : X.arc) * Math.abs(s.x1 - X.src.x) * 0.5;
      if (!s.bend) return (w) => lob(X.src.x, X.src.y, s.x1, s.y1, h, w);
      return (w) => { const [x, y] = lob(X.src.x, X.src.y, s.x1, s.y1, h, w), b = s.bend * 4 * w * (1 - w), [x2, y2] = lob(X.src.x, X.src.y, s.x1, s.y1, h, Math.min(1, w + 0.01)), b2 = s.bend * 4 * (w + 0.01) * (0.99 - w); return [x, y + b, Math.atan2(y2 + b2 - y - b, x2 - x)]; };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal;
      charge(X, u, layer, 0.02, X.T.windup);
      if (X.shape === "strike") {
        X.dst.forEach((d, i) => {
          const ti = X.T.impacts[i], q = X.tos[i], tt = u - ti, top = Math.min(d.y - 110 * SCALE, -4);
          if (layer === "floor") { if (u > ti - 0.2 && tt < 0.4) glowAt(q.x, q.y, (4 + 10 * seg(u, ti - 0.2, ti)) * k, pal, tt < 0 ? 0.5 : 0.8 * (1 - tt / 0.4)); return; }
          if (X.S.head === "fork") {
            if (tt > -0.06 && tt < 0.3 && (tt < 0.12 || fl(tt * 30) % 2 === 0)) fork(q.x + hr(X.seed, i, 3, -10, 10), top, q.x, q.y - 1, X.seed + i * 7 + fl(tt * 25), pal, 1 - seg(tt, 0.1, 0.3), true, 3);
          } else if (tt < 0) { const v = seg(u, ti - 0.22, ti); missile(X, (w) => [lerp(q.x - X.dir * 14, d.x, w), lerp(top, d.y, w), Math.atan2(d.y - top, X.dir * 14)], v, 1.15); }
          if (!X.P.miss) burst(X, d.x, d.y, tt, X.dir, 1.2);
        });
        return;
      }
      if (X.shape === "drain") {
        X.dst.forEach((d, i) => {
          const t0 = X.T.impacts[i], t1 = X.T.dur - 0.25;
          if (layer === "floor") { if (u > t1 - 0.1 && u < X.T.dur) glowAt(X.from.x, X.from.y, 9 * k, pal, 1 - seg(u, t1, X.T.dur)); return; }
          if (u < t0 - 0.05 || u > t1 + 0.1) return;
          const sag = 7 * k + Math.abs(d.x - X.src.x) * 0.05, grow = seg(u, t0 - 0.05, t0 + 0.2), fade = 1 - seg(u, t1 - 0.05, t1 + 0.1);
          // three strands sag between the two, and bright pulses run along them toward the caster
          for (let st = 0; st < 3; st++) {
            const amp = sag * [1, -0.45, 0.4][st], n = 40, ph0 = st * 0.33;
            let px = null, py = null;
            for (let j = 0; j <= n; j++) {
              const v = j / n;
              if (v > grow) break;
              const x = lerp(d.x, X.src.x, v), y = lerp(d.y, X.src.y, v) + Math.sin(v * Math.PI) * amp + Math.sin(v * 9 + u * 14 + st) * 1.5 * k;
              if (px !== null) {
                const pulse = ((v - (u - t0) * 1.8 - ph0) % 0.25 + 0.25) % 0.25 < 0.05;
                line(px, py, x, y, pulse ? pal[4] : st ? pal[2] : pal[3], fade);
                if (!st) line(px, py + 1, x, y + 1, pal[1], fade * 0.6);
              }
              px = x; py = y;
            }
          }
          for (let j = 0; j < 10; j++) {
            const ph = ((u - t0) * 1.4 + j / 10) % 1;
            if (u < t0 || ph > grow) continue;
            const x = lerp(d.x, X.src.x, ph), y = lerp(d.y, X.src.y, ph) + Math.sin(ph * Math.PI) * sag * (j % 2 ? 1 : -0.45);
            part(X.S.p === "tongue" ? "ember" : X.S.p === "fork" ? "spark" : X.S.p, x, y, 1.1 * k, Math.atan2(X.src.y - d.y, X.src.x - d.x), 0.1 + 0.4 * Math.abs(ph - 0.5), X.S, j, u);
          }
          if (fade > 0) { halo(d.x, d.y, 5 * k, pal, 0.6 * fade * grow); halo(X.src.x, X.src.y, 4 * k, pal, 0.6 * fade * grow); }
          if (u > t0 && u < t0 + 0.12) star(d.x, d.y, 4 * k, pal, 1);
          if (Math.abs(u - t1) < 0.1) star(X.src.x - X.dir * 3, X.src.y, 5 * k, pal, 1 - Math.abs(u - t1) / 0.1);
        });
        return;
      }
      for (const s of X.T.shots) {
        const path = this.path(X, s), v = seg(u, s.launch, s.at);
        if (layer === "floor") {
          if (X.shape === "lob" && u > s.launch && u < s.at) { const gx = lerp(X.from.x, s.x1, v), gy = lerp(X.from.y, X.tos[s.ti].y, v); gdisc(gx, gy, 3 * k, "rgba(20,12,8,0.35)", 0.6); }
          if (X.shape === "lob" && u > s.at - 0.25 && u < s.at + 0.5) ringDraw(X.tos[s.ti].x, X.tos[s.ti].y, (X.area || 16 * k), u < s.at ? u - s.at + 0.25 : u - s.at, X.P, u < s.at ? "tell" : "hit");
          continue;
        }
        if (u >= s.launch && u < s.at) missile(X, path, v, X.shape === "lance" ? 1.2 : X.shape === "swarm" ? 0.72 : 1, X.shape === "lance" && X.S.head === "flame" ? "flame" : null, X.seed + s.j);
        if (u >= s.at && !X.P.miss) {
          const tt = u - s.at;
          burst(X, s.x1, s.y1, tt, X.dir, X.shape === "swarm" ? 0.55 : X.shape === "lob" ? 1.4 : 1.1);
          if (X.shape === "lob" && (X.S.id === "flame" || X.S.id === "hearth") && tt < 0.6) for (let j = 0; j < 7; j++) { const a2 = hs(X.seed, j, 4) * TAU, r = hr(X.seed, j, 5, 2, 12) * k; tongue(X.tos[s.ti].x + Math.cos(a2) * r, X.tos[s.ti].y + Math.sin(a2) * r * FLAT - 3, (2.5 + hs(X.seed, j, 6) * 1.5) * k * (1 - tt / 0.6), -Math.PI / 2 + Math.sin(u * 20 + j) * 0.25, 0.9 - tt, pal); }
        } else if (u >= s.at && X.P.miss && u < s.at + 0.2) part(X.S.q === "dust" ? "dust" : X.S.p === "tongue" ? "smoke" : X.S.q, s.x1 + X.dir * (u - s.at) * 60, s.y1, k, 0, (u - s.at) / 0.2, X.S, 0, u);
      }
    },
    pose(X, role, u, i, o) {
      if (role === "actor") {
        if (u < X.T.windup) { const q = u / X.T.windup; o.dy = -1.5 * SCALE * q; o.tint = X.pal[3]; o.tintAmt = 0.18 * q * (0.6 + 0.4 * Math.sin(u * 40)); }
        else recoil(X, u, o, X.shape === "lance" ? 3 : 1.5);
        if (X.shape === "drain") { const t1 = X.T.dur - 0.25; if (Math.abs(u - t1) < 0.15) { o.tint = X.pal[3]; o.tintAmt = 0.25 * (1 - Math.abs(u - t1) / 0.15); } }
      } else {
        struck(X, u, i, o, X.shape === "lance" ? 5 : X.shape === "strike" ? 2 : X.shape === "drain" ? 0 : 3);
        if (X.shape === "drain") { const t0 = X.T.impacts[i]; if (u > t0 && u < X.T.dur - 0.2) { o.dx = Math.sin(u * 50) * 0.8; o.tint = X.pal[1]; o.tintAmt = 0.22; } }
        if (X.shape === "strike" && X.S.head === "fork") { const tt = u - X.T.impacts[i]; if (tt > 0 && tt < 0.3) { o.white = fl(tt * 30) % 2 ? 1 : 0.2; } }
      }
    },
    marks(X) {
      if (X.P.miss || !X.S.decal || X.shape === "drain") return [];
      const big = X.shape === "lob" || X.shape === "strike" || X.shape === "lance", m = [];
      if (!big && !X.P.crit) return m;
      X.tos.forEach((q, i) => m.push({ kind: ["stub", "cut", "skid", "scuff", "gouge"].includes(X.S.decal) ? "crack" : X.S.decal, x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: (X.shape === "lob" ? 1.1 : 0.7) * X.P.size, seed: X.seed + i, school: X.S.id } }));
      return m;
    },
  };

  // ===== beam: sustained rays, columns, cones and chains =====
  function beamLine(x0, y0, x1, y1, w, pal, a, wav, ph) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, fl(L)), nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    for (let i = 0; i <= n; i++) {
      const v = i / n, off = Math.sin(i * 0.35 + ph) * wav * Math.sin(v * Math.PI), cx = lerp(x0, x1, v) + nx * off, cy = lerp(y0, y1, v) + ny * off;
      const ww = w * (0.85 + 0.15 * Math.sin(i * 0.7 - ph * 3)) * Math.min(1, v * 8 + 0.3);
      for (let r = -Math.ceil(ww); r <= Math.ceil(ww); r++) {
        const ar = Math.abs(r) / Math.max(0.5, ww), col = ar < 0.3 ? pal[4] : ar < 0.6 ? pal[3] : ar < 0.9 ? pal[2] : pal[1];
        Pa(steep ? cx + r : cx, steep ? cy : cy + r, col, ar > 0.9 ? a * 0.5 : a);
      }
    }
  }
  FAM.beam = {
    shapes: ["ray", "pillar", "breath", "chain"], arc: 0.3,
    about: "sustained: a ray from the hands, a column from the sky, a cone of breath, a chain hopping foe to foe",
    time(X) {
      if (X.shape === "chain") { const imps = X.tos.map((q, i) => 0.38 + i * 0.11); return { windup: 0.3, impacts: imps, dur: lastOf(imps) + 0.55 }; }
      if (X.shape === "breath") return { windup: 0.28, impacts: X.tos.map((q, i) => 0.48 + Math.abs(q.x - X.from.x) / 900), dur: 1.25 };
      return { windup: 0.3, impacts: X.tos.map((q, i) => 0.4 + i * 0.03), dur: 1.15 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, on0 = X.T.impacts[0] - 0.04, off0 = X.T.dur - 0.22;
      const env = seg(u, on0, on0 + 0.06) * (1 - seg(u, off0, X.T.dur - 0.06));
      if (X.shape !== "pillar") charge(X, u, layer, 0.02, X.T.windup);
      if (X.shape === "ray") {
        if (layer === "floor") { if (env > 0) X.tos.forEach((q) => glowAt(q.x, q.y, 8 * k, pal, env * 0.7)); return; }
        X.dst.forEach((d, i) => {
          if (env <= 0) return;
          const w = (1.6 + 1.6 * k) * env * (1 + 0.15 * Math.sin(u * 50));
          beamLine(X.src.x, X.src.y, d.x + (X.P.miss ? X.dir * 30 : 0), d.y + (X.P.miss ? -10 : 0), w, pal, 1, X.arc * 4 * k, u * 30);
          for (let j = 0; j < 8; j++) { const ph = (u * 2.2 + j / 8) % 1; part(X.S.q === "dust" ? "spark" : X.S.p === "tongue" ? "ember" : X.S.p, lerp(X.src.x, d.x, ph), lerp(X.src.y, d.y, ph) + Math.sin(ph * 20 + j) * (w + 2), 0.7, Math.atan2(d.y - X.src.y, d.x - X.src.x), 0.2, X.S, j, u); }
          star(X.src.x, X.src.y, (3 + Math.sin(u * 40)) * k, pal, env);
          if (!X.P.miss) { star(d.x, d.y, (4 + 2 * Math.sin(u * 37)) * k, pal, env); if (u >= X.T.impacts[i]) burst(X, d.x, d.y, (u - X.T.impacts[i]) % 0.2, X.dir, 0.5); }
        });
        return;
      }
      if (X.shape === "pillar") {
        X.tos.forEach((q, i) => {
          const d = X.dst[i], top = -4, w = (4 + 3 * k) * env, tell = seg(u, 0.08, on0);
          if (layer === "floor") {
            if (u < on0) { gring(q.x, q.y, (16 - 8 * tell) * k, pal[3], tell, 1, 10); glowAt(q.x, q.y, 6 * k * tell, pal, tell * 0.6); }
            else if (env > 0) { glowAt(q.x, q.y, (w * 2.2 + 4), pal, env); gring(q.x, q.y, w * 2.4 + 4 + Math.sin(u * 30), pal[3], env, 1, 0); }
            return;
          }
          if (env <= 0) return;
          if (X.S.head === "fork") { if (fl(u * 30) % 3) fork(q.x, top, q.x, q.y, X.seed + fl(u * 22), pal, env, true, 4); fork(q.x + 2, top, q.x - 1, q.y, X.seed + 5 + fl(u * 17), pal, env * 0.6, false, 1); }
          else {
            const y0 = top, y1 = q.y;
            for (let x = -Math.ceil(w); x <= Math.ceil(w); x++) {
              const ar = Math.abs(x) / Math.max(0.6, w), col = ar < 0.3 ? pal[4] : ar < 0.6 ? pal[3] : ar < 0.88 ? pal[2] : pal[1];
              const wob = rnd(Math.sin(u * 25 + x) * 0.8);
              const a = ar > 0.88 ? 0.45 : 1;
              if (a >= 1) Rt(q.x + x + wob, y0, 1, y1 - y0, col);
              else for (let y = y0; y < y1; y += 1) if (on(q.x + x + wob, y, a)) P(q.x + x + wob, y, col);
            }
          }
          for (let j = 0; j < 10; j++) { const ph = (u * 1.4 + j / 10) % 1, px = q.x + hr(X.seed, j, 3, -1, 1) * w * 1.6, py = q.y - ph * 70 * k; part(X.S.p === "fork" ? "spark" : X.S.p === "tongue" ? "tongue" : X.S.q === "flake" ? "flake" : X.S.p, px, py, 0.8 * k, -Math.PI / 2, ph, X.S, j, u); }
          if (!X.P.miss) burst(X, d.x, d.y, u - X.T.impacts[i], X.dir, 1.3);
        });
        return;
      }
      if (X.shape === "breath") {
        if (layer === "floor") { X.tos.forEach((q, i) => { const tt = u - X.T.impacts[i]; if (tt > 0 && env > 0) glowAt(q.x, q.y, 9 * k, pal, env * 0.6); }); return; }
        const mx = X.from.x + X.dir * 8 * SCALE, my = X.from.y - hgt(X.from) * 0.7;
        const angs = X.dst.map((d) => Math.atan2(d.y - my, d.x - mx)), a0 = Math.min(...angs) - 0.18 - X.arc * 0.15, a1 = Math.max(...angs) + 0.18 + X.arc * 0.15;
        const reach = Math.max(...X.dst.map((d) => Math.hypot(d.x - mx, d.y - my))) + 10 * k;
        if (env > 0) { const a2 = (a0 + a1) / 2; for (let m = 0; m < 3; m++) halo(mx + Math.cos(a2) * (6 + m * 7) * k, my + Math.sin(a2) * (6 + m * 7) * k, (3 + m * 2.5) * k, X.pal, env * 0.75); }
        for (let j = 0; j < 96; j++) {
          const emit = on0 - 0.12 + (j / 96) * (off0 - on0 + 0.1), age = u - emit, travel = 0.32;
          if (age < 0 || age > travel) continue;
          const life = age / travel, ang = lerp(a0, a1, hs(X.seed, j, 1)), dd = reach * eOut(life) * hr(X.seed, j, 2, 0.75, 1.05);
          const kind = X.S.p === "fork" ? "spark" : X.S.p, px = mx + Math.cos(ang) * dd, py = my + Math.sin(ang) * dd - (X.S.p === "tongue" ? life * 6 : 0);
          part(kind, px, py, (0.9 + life * 1.5) * k, ang, life * 0.85, X.S, j, u);
          if (X.S.smoke && j % 3 === 0 && life > 0.55) part("smoke", px, py - 5, 1.4 * k, 0, (life - 0.55) * 2.2, X.S, j);
          else if (j % 4 === 0 && X.S.q && life < 0.8) part(X.S.q === "skull" ? "wisp" : X.S.q, px + 2, py + 2, k, ang, life, X.S, j, u);
        }
        X.dst.forEach((d, i) => { if (!X.P.miss && u > X.T.impacts[i]) burst(X, d.x, d.y, ((u - X.T.impacts[i]) % 0.2), X.dir, 0.45); });
        return;
      }
      if (layer === "floor") return;
      let px = X.src.x, py = X.src.y;
      X.dst.forEach((d, i) => {
        const ti = X.T.impacts[i], tt = u - ti, x0 = px, y0 = py;
        px = d.x; py = d.y;
        if (tt < -0.03 || tt > 0.42) return;
        const a = 1 - seg(tt, 0.2, 0.42);
        if (tt < 0) { const q = seg(tt, -0.03, 0); line(x0, y0, lerp(x0, d.x, q), lerp(y0, d.y, q), pal[4], 1); return; }
        if (X.S.head === "fork") { if (tt < 0.15 || fl(tt * 30) % 2 === 0) fork(x0, y0, d.x, d.y, X.seed + i * 11 + fl(tt * 24), pal, a, true, 2); }
        else beamLine(x0, y0, d.x, d.y, 1.2 * k * a, pal, a, 2 * k, u * 20);
        if (!X.P.miss) burst(X, d.x, d.y, tt, d.x > x0 ? 1 : -1, 0.9);
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") {
        if (u < X.T.windup) { const q = u / X.T.windup; o.dy = -1.5 * q; o.tint = X.pal[3]; o.tintAmt = 0.18 * q; }
        else if (u < X.T.dur - 0.2) { o.dx = -X.dir * (1 + Math.sin(u * 60) * 0.5) * SCALE; o.tint = X.pal[3]; o.tintAmt = 0.12; }
      } else {
        const tt = u - X.T.impacts[i];
        if (X.shape === "chain") { struck(X, u, i, o, 2); if (tt > 0 && tt < 0.3 && X.S.head === "fork") o.white = fl(tt * 30) % 2 ? 0.9 : 0.1; return; }
        if (tt > 0 && u < X.T.dur - 0.2 && !X.P.miss) { o.dx = tdir(X, i) * (2 + Math.sin(u * 70)) * SCALE; o.white = fl(u * 20) % 2 ? 0.5 : 0.15; o.tint = X.pal[2]; o.tintAmt = 0.2; }
        else struck(X, u, i, o, 3);
      }
    },
    marks(X) {
      if (X.P.miss || !X.S.decal || ["stub", "cut", "skid", "gouge"].includes(X.S.decal)) return [];
      if (X.shape === "chain" || X.shape === "ray") return X.P.crit ? X.tos.map((q, i) => ({ kind: X.S.decal === "scuff" ? "crack" : X.S.decal, x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.6, seed: X.seed + i, school: X.S.id } })) : [];
      return X.tos.map((q, i) => ({ kind: X.S.decal === "scuff" ? "crack" : X.S.decal, x: q.x, y: q.y + 1, at: X.T.impacts[i] + 0.2, opts: { size: X.shape === "pillar" ? 1.2 : 0.9, seed: X.seed + i, school: X.S.id } }));
    },
  };

  // ===== nova: area spells, marked by a ring on the floor =====
  const RAIN_HEAD = { physical: "arrow", marksman: "arrow", blade: "arrow", road: "arrow", beast: "arrow", riding: "arrow" };
  function areaR(X) { const xs = X.tos.map((q) => q.x); return X.area || Math.max(20 * X.k, (Math.max(...xs) - Math.min(...xs)) / 2 + 14 * X.k); }
  function cloud(X, cx, cy, R, u, t0, t1, ry) {
    const S = X.S, pal = X.pal, k = X.k, fade = seg(u, t0, t0 + 0.2) * (1 - seg(u, t1 - 0.3, t1));
    if (fade <= 0) return;
    const cols = S.id === "frost" ? ["#9ab8d0", "#d8ecf8", "#ffffff"] : S.id === "poison" ? [pal[0], pal[1], pal[2]] : S.id === "holy" ? [pal[1], pal[3], pal[4]] : S.id === "storm" ? ["#2a2c48", "#4a4e70", "#7078a0"] : [pal[0], pal[1], pal[2]];
    for (let j = 0; j < 12; j++) {
      const a = j / 12 * TAU + u * 0.8 * (j % 2 ? 1 : -1), rr = R * hr(X.seed, j, 1, 0.2, 0.85), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * (ry || 0.3);
      blob(x, y, (3 + 2.5 * hs(X.seed, j, 2)) * k * (0.7 + 0.3 * fade), cols, fade * 0.85);
    }
    for (let j = 0; j < 8; j++) {
      const ph = (u * 1.6 + j / 8) % 1, x = cx + hr(X.seed, j, 3, -1, 1) * R * 0.8, y = cy + ph * 18 * k;
      if (S.id === "frost") part("flake", x, y, 0.8, 0, ph, S, j);
      else if (S.id === "storm") { if (fl(u * 12 + j) % 5 === 0) fork(x, cy, x + 2, cy + 9 * k, X.seed + fl(u * 20) + j, pal, fade, false, 0); }
      else if (S.id === "holy" || S.id === "healing") part("mote", x, cy - ph * 10, 1, 0, ph, S, j, u);
      else if (S.p === "drip" || S.id === "shadow" || S.id === "death") drip(x, y, 2, S.id === "shadow" || S.id === "death" ? [pal[0], pal[1], pal[2], pal[3], pal[3]] : pal, fade * (1 - ph));
    }
  }
  FAM.nova = {
    shapes: ["burst", "rain", "eruption", "storm", "cloud"], arc: 0.3,
    about: "area spells: a burst across the floor, a rain from above, spikes from below, a lightning storm, a lingering cloud",
    count: (X) => (X.shape === "rain" ? 10 : X.shape === "storm" ? 4 : X.shape === "eruption" ? X.tos.length + 3 : 1),
    drops(X) {
      const R = areaR(X), out = [], N = X.shape === "rain" ? X.n : X.shape === "storm" ? Math.max(X.n, X.tos.length) : X.n;
      for (let j = 0; j < N; j++) {
        const onT = j < X.tos.length, a = hs(X.seed, j, 1) * TAU, r = Math.sqrt(hs(X.seed, j, 2)) * R * 0.85;
        const x = onT ? X.tos[j].x + hr(X.seed, j, 3, -2, 2) : X.cx + Math.cos(a) * r, y = onT ? X.tos[j].y : X.cy + Math.sin(a) * r * FLAT;
        const at = X.shape === "storm" ? 0.42 + j * 0.13 : X.shape === "rain" ? 0.48 + hs(X.seed, j, 4) * 0.35 * (onT ? 0.3 : 1) + (onT ? j * 0.04 : 0) : 0.45 + (onT ? j * 0.05 : 0.08 + hs(X.seed, j, 5) * 0.2);
        out.push({ j, ti: onT ? j : -1, x, y, at });
      }
      return out;
    },
    time(X) {
      if (X.shape === "cloud") return { windup: 0.32, impacts: X.tos.map((q, i) => 0.55 + i * 0.04), dur: 1.6, R: areaR(X) };
      if (X.shape === "burst") { const ts = byDist(X, X.cx, X.cy, 260, 0.45); return { windup: 0.35, impacts: ts, dur: Math.max(...ts) + 0.65, R: areaR(X) }; }
      const dr = this.drops(X), imps = X.tos.map((q, i) => dr[i].at);
      return { windup: 0.35, impacts: imps, dur: Math.max(...dr.map((d) => d.at)) + 0.6, drops: dr, R: areaR(X) };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, R = X.T.R, imp = Math.min(...X.T.impacts), S = X.S;
      charge(X, u, layer, 0.02, X.T.windup);
      if (layer === "floor") {
        if (u < imp + 0.05) ringDraw(X.cx, X.cy, R, u - 0.1, X.P, "tell");
        else ringDraw(X.cx, X.cy, R, u - imp, X.P, "hit");
        if (X.shape === "burst" && u > imp - 0.05) { const tt = u - imp + 0.05; glowAt(X.cx, X.cy, R * eOut(Math.min(1, tt / 0.3)), pal, 0.5 * (1 - seg(tt, 0.2, 0.7))); }
        if (X.shape === "storm" || X.shape === "rain" || X.shape === "eruption") for (const d of X.T.drops) { const tt = u - d.at; if (tt > -0.15 && tt < 0.3) glowAt(d.x, d.y, (tt < 0 ? 3 + (tt + 0.15) * 20 : 6) * k, pal, tt < 0 ? 0.4 : 0.6 * (1 - tt / 0.3)); }
        return;
      }
      if (X.shape === "burst") {
        const tt = u - imp + 0.05;
        if (tt < 0 || tt > 0.8) return;
        for (let j = 0; j < 28; j++) {
          const a = j / 28 * TAU + hs(X.seed, j, 1) * 0.2, life = tt / hr(X.seed, j, 2, 0.5, 0.75), d = R * eOut3(Math.min(1, tt / 0.4)) * hr(X.seed, j, 3, 0.7, 1.05);
          const x = X.cx + Math.cos(a) * d, y = X.cy + Math.sin(a) * d * FLAT;
          const kind = S.p === "fork" ? "spark" : S.p === "chevron" ? "glint" : S.p;
          part(kind, x, y - (kind === "tongue" ? 2 : 4) - (kind === "mote" || kind === "plus" || kind === "note" ? tt * 20 : 0), (0.7 + 0.5 * hs(X.seed, j, 4)) * k, kind === "tongue" ? -Math.PI / 2 : a, life, S, j, u);
        }
        if (tt < 0.1) star(X.cx, X.cy - 6 * k, 8 * k * (1 - tt / 0.1), pal, 1);
        if (tt < 0.3) halo(X.cx, X.cy - 4 * k, 11 * k * (1 - tt / 0.3) + 3, pal, 0.85);
        // the wave front: a ring of short risers, the school's material standing up off the floor
        const front = R * eOut3(Math.min(1, tt / 0.4)), wf = 1 - seg(tt, 0.25, 0.65), light = ["holy", "healing", "arcane", "lore", "song", "trade", "command", "storm", "illusion"].includes(S.id);
        if (wf > 0) for (let j = 0; j < 22; j++) {
          const a = j / 22 * TAU + 0.13, x = X.cx + Math.cos(a) * front, y = X.cy + Math.sin(a) * front * FLAT, hh = (10 + 7 * hs(X.seed, j, 7)) * k * wf;
          if (light) { line(x - 1, y, x - 1, y - hh * 0.8, pal[1], wf); line(x, y, x, y - hh, pal[3], wf); line(x + 1, y, x + 1, y - hh * 0.6, pal[2], wf); Pa(x, y - hh, pal[4], wf); Pa(x, y - hh - 1, pal[4], wf * 0.6); }
          else if (S.p === "tongue") tongue(x, y - hh * 0.35, Math.min(3.6, hh * 0.3), -Math.PI / 2 + Math.sin(u * 20 + j) * 0.2, wf, pal, 1);
          else if (S.p === "wisp") { tongue(x, y - hh * 0.35, Math.min(3.4, hh * 0.28), -Math.PI / 2 + Math.sin(u * 14 + j) * 0.3, wf * 0.9, [pal[0], pal[1], pal[2], pal[3], pal[4]], 1); if (j % 3 === 0) wisp(x, y - hh * 0.9, 1.4, -Math.PI / 2, pal, wf, u * 9 + j); }
          else if (S.p === "drip") part("bubble", x, y - hh * (1 - wf) - 2, 1.2 * k, -Math.PI / 2, 1 - wf, S, j, u);
          else if (S.p === "leaf") leaf(x, y - hh * (1 - wf) * 1.4 - 2, -Math.PI / 2 + j, pal, wf, 1.1);
          else part("dust", x, y - 2, k, 0, 1 - wf, S, j);
        }
        if (S.p === "fork" && tt < 0.3) for (let j = 0; j < 5; j++) { const a = j / 5 * TAU + 0.3; fork(X.cx, X.cy - 4, X.cx + Math.cos(a) * R * 0.9, X.cy + Math.sin(a) * R * FLAT * 0.9, X.seed + j + fl(u * 20), pal, 1 - tt / 0.3, false, 1); }
        if (S.id === "frost" && tt < 0.6) for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, rr = R * 0.6 * eOut(Math.min(1, tt / 0.25)); spike(X.cx + Math.cos(a) * rr, X.cy + Math.sin(a) * rr * FLAT, 8 * k * Math.sin(Math.min(1, tt / 0.6) * Math.PI), X, 1); }
      } else if (X.shape === "cloud") {
        cloud(X, X.cx, X.cy - hgt(X.tos[0]) * 0.8, R, u, 0.3, X.T.dur, 0.3);
      } else {
        for (const d of X.T.drops) {
          const tt = u - d.at, top = d.y - 120 * SCALE;
          if (X.shape === "storm") {
            if (tt > -0.04 && tt < 0.28 && (tt < 0.1 || fl(tt * 30) % 2 === 0)) fork(d.x + hr(X.seed, d.j, 6, -14, 14), Math.max(-4, top), d.x, d.y - 1, X.seed + d.j * 13 + fl(tt * 25), pal, 1 - seg(tt, 0.08, 0.28), true, 2);
            if (tt > 0 && tt < 0.4) burst(X, d.x, d.y - 2, tt, X.dir, 0.8, "fork");
          } else if (X.shape === "rain") {
            const fall = 0.28, v = seg(u, d.at - fall, d.at), x0 = d.x - X.dir * 28 * k;
            if (tt < 0 && v > 0) {
              const path = (w) => [lerp(x0, d.x, w), lerp(top, d.y - 1, w), Math.atan2(d.y - 1 - top, d.x - x0)];
              if (RAIN_HEAD[S.id]) { const [x, y, a] = path(v); arrowSprite(x, y, a, X, 9, false); }
              else missile(X, path, v, 0.6, null, X.seed + d.j);
            }
            if (tt >= 0) burst(X, d.x, d.y - 1, tt, X.dir, d.ti >= 0 ? 0.6 : 0.4, RAIN_HEAD[S.id] ? "spark" : null);
          } else {
            const life = seg(u, d.at - 0.06, d.at + 0.1) * (1 - seg(u, d.at + 0.35, d.at + 0.6)), h = (d.ti >= 0 ? 20 : 12) * k * life;
            if (life > 0) { spike(d.x - 2 * k, d.y, h * 0.7, X, 1, 2); spike(d.x, d.y + 1, h, X, 1, 2.8); spike(d.x + 2.5 * k, d.y, h * 0.6, X, 1, 2); }
            if (tt > 0 && d.ti >= 0) burst(X, d.x, d.y - 8 * k, tt, X.dir, 0.8);
          }
        }
      }
    },
    pose(X, role, u, i, o) {
      if (role === "actor") {
        if (u < X.T.windup) { const q = u / X.T.windup; o.dy = -2 * q; o.tint = X.pal[3]; o.tintAmt = 0.18 * q; o.sy = 1 + 0.04 * q; }
        else recoil(X, u, o, 1);
      } else {
        const q = X.tos[i], d = q.x === X.cx ? tdir(X, i) : q.x > X.cx ? 1 : -1, tt = u - X.T.impacts[i];
        struck(X, u, i, o, 3);
        if (tt > 0) o.dx = (o.dx || 0) * d * tdir(X, i);
        if (X.shape === "cloud" && tt > 0 && u < X.T.dur - 0.3) { o.tint = X.pal[1]; o.tintAmt = 0.3; }
      }
    },
    marks(X) {
      if (X.P.miss) return [];
      const kd = X.S.decal && !["stub", "cut", "skid", "gouge"].includes(X.S.decal) ? (X.S.decal === "scuff" ? "crack" : X.S.decal) : "crack", m = [];
      if (X.shape === "burst") { m.push({ kind: "scuff", x: X.cx, y: X.cy, at: X.T.impacts[0], opts: { size: X.T.R / 22, seed: X.seed } }); X.tos.forEach((q, i) => m.push({ kind: kd, x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.7, seed: X.seed + i, school: X.S.id } })); }
      else if (X.shape === "cloud") { if (X.S.decal === "puddle" || X.S.id === "frost") X.tos.forEach((q, i) => m.push({ kind: X.S.decal, x: q.x, y: q.y + 1, at: X.T.impacts[i] + 0.3, opts: { size: 0.8, seed: X.seed + i, school: X.S.id } })); }
      else for (const d of X.T.drops) if (d.ti >= 0 || hs(X.seed, d.j, 9) < 0.5) m.push({ kind: RAIN_HEAD[X.S.id] && X.shape === "rain" ? "stub" : kd, x: d.x, y: d.y + 1, at: d.at, opts: { size: d.ti >= 0 ? 0.75 : 0.45, seed: X.seed + d.j, school: X.S.id, flip: X.dir < 0 } });
      return m;
    },
  };

  // ===== heal =====
  function rise(X, q, u, t0, t1, n, kind, R) {
    const k = X.k, h = hgt(q);
    for (let j = 0; j < n; j++) {
      const st = t0 + (t1 - t0) * (j / n) * 0.7, life = seg(u, st, st + (t1 - t0) * 0.55);
      if (life <= 0 || life >= 1) continue;
      const a = hs(X.seed, j, 1) * TAU + life * 3.5, r = (R || 9) * k * (1 - life * 0.4);
      const x = q.x + Math.cos(a) * r, y = q.y - 2 - life * (h + 10 * k) + Math.sin(a) * r * FLAT;
      part(kind, x, y, (0.8 + 0.6 * hs(X.seed, j, 2)) * k, -Math.PI / 2, life, X.S, j, u);
    }
  }
  const HEAL_KIND = { flame: "ember", storm: "spark", fury: "streak", frost: "flake", death: "wisp", shadow: "wisp", blade: "glint", physical: "glint" };
  FAM.heal = {
    shapes: ["motes", "glyph", "wave", "regen"], arc: 0.3,
    about: "healing: motes spiral up, a glyph turns on the floor, a wave rolls over the party, leaves and shoots curl up",
    count: (X) => 12,
    time(X) {
      if (X.shape === "wave") { const ts = byDist(X, X.from.x, X.from.y, 180, 0.32); return { windup: 0.25, impacts: ts, dur: Math.max(...ts) + 0.75 }; }
      return { windup: 0.25, impacts: X.tos.map((q, i) => (X.shape === "glyph" ? 0.52 : 0.45) + i * 0.06), dur: 1.05 + X.tos.length * 0.06 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, kind = HEAL_KIND[X.S.id] || X.S.p;
      if (X.tos[0] !== X.from) charge(X, u, layer, 0.02, X.T.windup);
      if (X.shape === "wave" && layer === "floor") {
        const tt = u - 0.3, Rm = Math.max(...X.tos.map((q) => Math.hypot(q.x - X.from.x, (q.y - X.from.y) / FLAT))) + 12;
        if (tt > 0 && tt < Rm / 180 + 0.3) { const r = tt * 180; gring(X.from.x, X.from.y, r, pal[3], 1 - seg(r, Rm - 10, Rm + 20), 2, 0); gring(X.from.x, X.from.y, r - 5, pal[2], 0.5 * (1 - r / (Rm + 20)), 1, 12); }
      }
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], t0 = ti - 0.22, t1 = ti + 0.55, glow = seg(u, t0, ti) * (1 - seg(u, ti + 0.3, X.T.dur));
        if (layer === "floor") {
          if (glow > 0) glowAt(q.x, q.y, (8 + 2 * Math.sin(u * 12)) * k, pal, glow * 0.8);
          if (X.shape === "glyph" && glow > 0) {
            const r = 16 * k * eOut(seg(u, t0 - 0.1, ti)), spin = u * 2.2;
            gring(q.x, q.y, r, pal[3], glow, 1, 0); gring(q.x, q.y, r * 0.66, pal[2], glow, 1, 8);
            for (let j = 0; j < 6; j++) { const a = spin + j / 6 * TAU; part("rune", q.x + Math.cos(a) * r * 0.84, q.y + Math.sin(a) * r * 0.84 * FLAT, 0.8, 0, 1 - glow, X.S, j + X.seed); }
          }
          return;
        }
        if (X.shape === "regen") {
          for (let j = 0; j < 3; j++) {
            const grow = seg(u, t0 + j * 0.05, ti + 0.15), fade = 1 - seg(u, t1, X.T.dur), side = j - 1;
            for (let m = 0; m < 16 * grow; m++) { const y = q.y - m * hgt(q) / 22, x = q.x + side * 6 * k + Math.sin(m * 0.5 + j * 2) * 2.5 * k; Pa(x, y, m % 5 === 4 ? pal[3] : pal[1], fade); if (m % 5 === 2) leaf(x + (j % 2 ? 2 : -2), y, -Math.PI / 2 + side, pal, fade, 0.8); }
          }
          rise(X, q, u, t0, t1, 8, "leaf", 11);
        }
        rise(X, q, u, t0, t1 + 0.1, X.n, kind, X.shape === "glyph" ? 11 : 9);
        const tt = u - ti;
        if (tt > 0 && tt < 0.4) {
          for (let j = 0; j < 6; j++) { const a = j / 6 * TAU, rr = 4 + tt * 30; part(kind === "plus" ? "plus" : "glint", q.x + Math.cos(a) * rr * k, q.y - hgt(q) * 0.55 + Math.sin(a) * rr * 0.6 * k - tt * 10, 1.2 * k, 0, tt / 0.4, X.S, j, u); }
          if (tt < 0.1) star(q.x, q.y - hgt(q) * 0.55, 5 * k, pal, 1 - tt / 0.1);
        }
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u < X.T.windup + 0.1) { const q = seg(u, 0, X.T.windup); o.dy = -1.5 * Math.sin(q * Math.PI); o.tint = X.pal[3]; o.tintAmt = 0.2 * Math.sin(q * Math.PI); } return; }
      const tt = u - X.T.impacts[i];
      if (tt > -0.2 && tt < 0.6) { const q = tt < 0 ? 0 : 1 - seg(tt, 0.05, 0.6); o.tint = X.pal[3]; o.tintAmt = 0.32 * q + (tt < 0 ? 0.15 * (1 + tt / 0.2) : 0); o.dy = tt > 0 && tt < 0.2 ? -2 * Math.sin(tt / 0.2 * Math.PI) * SCALE : 0; }
    },
    marks(X) { return X.shape === "regen" || X.S.id === "wild" ? X.tos.map((q, i) => ({ kind: "vines", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.5, seed: X.seed + i, school: "wild" } })) : []; },
  };

  // ===== buff =====
  function aura(X, q, u, a, n) {
    const k = X.k, pal = X.pal, h = hgt(q);
    for (let j = 0; j < (n || 12); j++) {
      const ph = (u * 1.8 + hs(X.seed, j, 1)) % 1, x = q.x + hr(X.seed, j, 2, -1, 1) * 9 * k, y = q.y - ph * (h + 6);
      const len = 3 + fl(4 * k * (1 - ph)), col = ph < 0.3 ? pal[4] : ph < 0.6 ? pal[3] : pal[2], aa = a * Math.min(1, (1 - ph) * 1.6);
      for (let m = 0; m < len; m++) { Pa(x - 1, y + m, pal[1], aa * 0.8); Pa(x, y + m, m === 0 ? col : pal[3], aa); Pa(x + 1, y + m + 1, pal[2], aa * 0.7); }
    }
  }
  // the path: pale, not-quite-daylight, and cloven prints that glow where nothing walked
  const PALE = ["#26364a", "#6e88a6", "#b8d0ea", "#e8f4ff", "#ffffff"];
  const PRINT = 9;
  // a cloven print: two toes with a dark rim so it reads on pale stone, glowing while it's fresh
  function hoofprint(x, y, pal, a, fresh, age) {
    x = fl(x); y = fl(y);
    if (fresh > 0) { gdisc(x, y, 7, pal[2], a * 0.6 * fresh); Pa(x, y - 3 - age * 14, pal[4], fresh); Pa(x + 1, y - 6 - age * 20, pal[3], fresh * 0.7); }
    for (const dx of [-2, 1]) {
      for (const [ox, oy] of [[-1, -1], [-1, 0], [2, -1], [2, 0], [0, -2], [1, -2], [0, 2], [1, 2]]) Pa(x + dx + ox, y + oy, pal[0], a * 0.6);
      for (let yy = -1; yy <= 1; yy++) { const c = yy < 0 ? (fresh > 0.3 ? pal[4] : pal[3]) : yy ? pal[2] : pal[3]; Pa(x + dx, y + yy, c, a); Pa(x + dx + 1, y + yy, c, a); }
    }
  }
  function hartsPath(X, u, layer) {
    const k = X.k, pal = X.P.tint ? X.pal : PALE, f = X.from, w = X.T.windup, end = X.T.dur;
    if (layer === "floor") {
      glowAt(f.x, f.y, 12 * k, pal, Math.sin(seg(u, 0, w + 0.4) * Math.PI) * 0.8);
      // the trail runs out both ways as far as the furthest ally on each side, two prints to a stride, a step in front of
      // the line so health bars never sit on it
      for (const sd of [-1, 1]) {
        const fq = X.tos.reduce((m, q) => ((q.x - f.x) * sd > (m.x - f.x) * sd ? q : m), f), far = (fq.x - f.x) * sd;
        for (let n = 1; n * PRINT * k <= far + 4; n++) {
          const d = n * PRINT * k, at = w + 0.15 + d / X.T.rate, age = u - at;
          if (age < 0) break;
          const y = lerp(f.y, fq.y, Math.min(1, d / Math.max(1, far))) + 10 * SCALE + (n % 2 ? 2 : -1);
          hoofprint(f.x + sd * d, y, pal, 1 - seg(u, end - 0.35, end), 1 - seg(age, 0, 0.6), age);
        }
      }
      X.tos.forEach((q, i) => { const tt = u - X.T.impacts[i]; if (tt > 0 && tt < 0.45) gring(q.x, q.y, (5 + tt * 40) * k, pal[4], 1 - tt / 0.45, 1, 0); });
      return;
    }
    // a shaft of pale light settles on the rider before the path opens
    const q0 = seg(u, 0, w + 0.35), la = Math.sin(q0 * Math.PI), hh = hgt(f);
    if (la > 0) for (let m = 0; m < hh + 16; m++) {
      const y = f.y - m, wv = 5 * k * (1 - m / (hh + 24));
      Pa(f.x - wv, y, pal[2], la * 0.4); Pa(f.x + wv, y, pal[2], la * 0.4);
      if (m % 4 === 0) Pa(f.x + Math.sin(m * 1.3 + u * 9) * wv * 0.6, y, pal[4], la * 0.6);
    }
    X.tos.forEach((q, i) => {
      const ti = X.T.impacts[i], tt = u - ti, h = head(q), fade = seg(u, ti - 0.1, ti) * (1 - seg(u, end - 0.35, end));
      if (tt < -0.1) return;
      aura(Object.assign({}, X, { pal }), q, u, fade * 0.8, 8);
      if (tt > 0 && tt < 0.3) { const e = h.x + (q.x === f.x ? X.dir : q.x > f.x ? -1 : 1) * -2; star(e, h.y + 5, 4 * k, pal, 1 - tt / 0.3); }
      for (let j = 0; j < 4; j++) { const ph = seg(tt, j * 0.08, 0.7 + j * 0.08); if (ph > 0 && ph < 1) Pa(q.x + (j - 1.5) * 4 * k, h.y - 2 - ph * 14, ph < 0.4 ? pal[4] : pal[3], 1 - ph); }
    });
  }
  FAM.buff = {
    shapes: ["aura", "chevrons", "shout", "vanish", "rage", "path"], arc: 0.3,
    about: "boosts: an aura licks up the body, chevrons climb, a rallying shout rings out, a vanish into smoke, a rage of red streaks, a path of glowing hoofprints",
    count: (X) => 3,
    time(X) {
      if (X.shape === "path") { const rate = 170, ts = X.tos.map((q) => 0.45 + Math.abs(q.x - X.from.x) / rate); return { windup: 0.3, impacts: ts, dur: Math.max(...ts) + 0.95, rate }; }
      if (X.shape === "shout") { const ts = byDist(X, X.from.x, X.from.y, 220, 0.3); return { windup: 0.22, impacts: ts, dur: Math.max(...ts) + 0.75 }; }
      if (X.shape === "vanish") return { windup: 0.15, impacts: [0.3], dur: 0.95 };
      if (X.shape === "rage") return { windup: 0.2, impacts: X.tos.map((q, i) => 0.35 + i * 0.06), dur: 1.15 };
      return { windup: 0.2, impacts: X.tos.map((q, i) => 0.35 + i * 0.08), dur: 1.0 + X.tos.length * 0.08 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, S = X.S;
      if (X.shape === "path") return hartsPath(X, u, layer);
      if (X.shape === "shout") {
        const hd = head(X.from), tt = u - X.T.windup;
        if (layer === "floor") { if (tt > 0 && tt < 0.7) gring(X.from.x, X.from.y, tt * 120 * k, pal[3], 1 - tt / 0.7, 1, 14); return; }
        for (let r = 0; r < 3; r++) {
          const t2 = tt - r * 0.1;
          if (t2 < 0 || t2 > 0.45) continue;
          const rr = (5 + t2 * 70) * k, a = 1 - t2 / 0.45;
          for (const sd of [1, -1]) for (let m = -9; m <= 9; m++) {
            const th = (sd > 0 ? 0 : Math.PI) + m * 0.08, px = hd.x + X.dir * 2 + Math.cos(th) * rr, py = hd.y + 4 + Math.sin(th) * rr * 0.9, aa = sd === X.dir ? a : a * 0.5;
            Pa(px + Math.cos(th), py + Math.sin(th), pal[1], aa); Pa(px, py, pal[2], aa); Pa(px - Math.cos(th), py - Math.sin(th), pal[3], aa * 0.8);
          }
        }
        X.tos.forEach((q, i) => {
          if (q === X.from) return;
          const t3 = u - X.T.impacts[i], h = head(q);
          if (t3 < 0 || t3 > 0.7) return;
          chevron(h.x, h.y - 4 - t3 * 14, 3, pal[2], pal[0], 1 - seg(t3, 0.45, 0.7)); chevron(h.x, h.y - 1 - t3 * 14, 3, pal[3], pal[1], 1 - seg(t3, 0.45, 0.7));
          if (t3 < 0.2) { halo(h.x, h.y + 4, 7 * k, pal, 0.6 * (1 - t3 / 0.2)); star(h.x + 5, h.y - 2, 4 * k, pal, 1 - t3 / 0.2); }
        });
        return;
      }
      if (X.shape === "vanish") {
        const tt = u - X.T.impacts[0], q = X.from, c = chest(q);
        if (layer === "floor") { if (tt > -0.1 && tt < 0.5) glowAt(q.x, q.y, 9 * k, ["#000", "#000", "rgba(10,6,16,0.6)"], 1 - seg(tt, 0.2, 0.5)); return; }
        if (tt < -0.15) return;
        for (let j = 0; j < 10; j++) {
          const a = j / 10 * TAU + hs(X.seed, j, 1), life = seg(tt, -0.05, 0.55), d = (3 + 14 * eOut(life)) * k;
          blob(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8 - life * 6, (2.5 + 1.5 * hs(X.seed, j, 2)) * k * (1 + life * 0.5), S.id === "shadow" ? [pal[0], pal[1], pal[2]] : SMOKE, (1 - life) * 0.95);
        }
        for (let j = 0; j < 6; j++) { const life = seg(tt, j * 0.04, 0.4 + j * 0.05); part("wisp", c.x + (j - 2.5) * 3 * k, c.y - life * 20, k, -Math.PI / 2, life, SCHOOLS.shadow, j, u); }
        if (tt > 0 && tt < 0.08) star(c.x, c.y, 5 * k, pal, 1);
        return;
      }
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, h = head(q), fade = seg(u, ti - 0.15, ti) * (1 - seg(u, X.T.dur - 0.3, X.T.dur));
        if (layer === "floor") {
          if (fade > 0) { gring(q.x, q.y, (9 + Math.sin(u * 14) * 1) * k, pal[3], fade, 1, 0); glowAt(q.x, q.y, 8 * k, pal, fade * 0.5); }
          if (tt > 0 && tt < 0.35) gring(q.x, q.y, (6 + tt * 50) * k, pal[4], 1 - tt / 0.35, 1, 0);
          return;
        }
        if (X.shape === "aura") { aura(X, q, u, fade, 16); if (fade > 0) halo(q.x, q.y - hgt(q) * 0.5, 9 * k, pal, fade * 0.3); }
        if (X.shape === "rage") {
          // rising heat flares on the flanks, hot heads first, so the rage reads as fire and never as anything dripping
          const fp = SCHOOLS.fury.pal, hot = ["#ffe8a0", "#ffc860", "#ff8a3a", "#e0402c"];
          for (let j = 0; j < 12; j++) {
            const ph = (u * 2.4 + hs(X.seed, j, 1)) % 1, side = j % 2 ? 1 : -1, x = q.x + side * (6 + hr(X.seed, j, 2, 0, 6)) * k + side * ph * 3, y = q.y - 2 - ph * (hgt(q) + 14);
            const a = fade * (1 - ph) * 1.3, L = 6 * k;
            for (let m = 0; m < L; m++) Pa(x - side * m * 0.25, y + m, m < 1.5 ? hot[0] : m < 3 ? hot[1] : m < 4.5 ? hot[2] : hot[3], a * (1 - m / (L + 2)));
            Pa(x + side, y + 1, fp[1], a * 0.6);
          }
          if (fade > 0) { halo(q.x, q.y - hgt(q) * 0.5, 11 * k, SCHOOLS.fury.pal, fade * 0.25); }
          for (let j = 0; j < 3; j++) { const ph = (u * 1.3 + j / 3) % 1; part("steam", h.x + (j - 1) * 4, h.y - 2 - ph * 12, k, 0, ph * 0.8 + (1 - fade) * 0.4, S, j); }
        }
        if (X.shape === "chevrons" || X.shape === "aura") for (let j = 0; j < X.n; j++) {
          const t2 = tt - j * 0.1;
          if (t2 < 0 || t2 > 0.7) continue;
          chevron(h.x, h.y - 2 - t2 * 22 * k - j * 1, 2 + rnd(k * 1.4), pal[3], pal[1], 1 - seg(t2, 0.4, 0.7));
        }
        if (tt > 0 && tt < 0.12) star(h.x + 5 * X.dir, h.y + 2, 4 * k, pal, 1 - tt / 0.12);
      });
    },
    pose(X, role, u, i, o) {
      const tt = u - X.T.impacts[Math.max(0, i)];
      if (X.shape === "path") {
        const pal = X.P.tint ? X.pal : PALE;
        if (role === "actor") { const q = seg(u, 0, X.T.windup + 0.35); o.dy = -1.5 * Math.sin(q * Math.PI) * SCALE; o.tint = pal[3]; o.tintAmt = 0.22 * Math.sin(q * Math.PI); }
        if (role === "target" && tt > -0.05 && tt < 0.6) { o.tint = pal[3]; o.tintAmt = 0.2 * (1 - seg(tt, 0, 0.6)); o.dy = tt > 0 && tt < 0.2 ? -2 * Math.sin(tt / 0.2 * Math.PI) * SCALE : 0; }
        return;
      }
      if (X.shape === "vanish") { if (role === "actor") { o.alpha = 1 - 0.68 * seg(u, X.T.impacts[0] - 0.05, X.T.impacts[0] + 0.15); o.dx = -X.dir * 3 * seg(u, 0.2, 0.4) * SCALE; } return; }
      if (X.shape === "rage" && (role === "target" || X.tos[0] === X.from)) {
        if (u > 0.1 && u < X.T.dur - 0.2) { o.dx = Math.sin(u * 80) * 0.8; o.sx = 1 + 0.06 * Math.sin(seg(u, 0.1, 0.5) * Math.PI); o.sy = o.sx; o.tint = X.pal[2]; o.tintAmt = 0.12 + 0.1 * Math.sin(u * 30); }
        return;
      }
      if (role === "actor") { if (X.shape === "shout") { const q = seg(u, 0.05, X.T.windup + 0.25); o.sy = 1 + 0.08 * Math.sin(q * Math.PI); o.dy = -2 * Math.sin(q * Math.PI); } else if (u < X.T.windup) o.dy = -1; }
      if (role === "target" && tt > -0.05 && tt < 0.5) { o.tint = X.pal[3]; o.tintAmt = 0.3 * (1 - seg(tt, 0, 0.5)); o.dy = tt > 0 && tt < 0.18 ? -2.5 * Math.sin(tt / 0.18 * Math.PI) * SCALE : 0; }
    },
    marks(X) {
      if (X.shape === "path") return [{ kind: "hoof", x: X.from.x + X.dir * 14 * SCALE, y: X.from.y + 10 * SCALE, at: X.T.windup + 0.2, opts: { flip: X.dir < 0, seed: X.seed } }];
      return X.shape === "rage" ? [{ kind: "crack", x: X.from.x, y: X.from.y + 1, at: 0.4, opts: { size: 0.5, seed: X.seed } }] : [];
    },
  };

  // ===== summon: the newcomer arrives at `to` =====
  FAM.summon = {
    shapes: ["circle", "rise", "call", "puff"], arc: 0,
    about: "a summoning: a rune circle and a column of light, a rising from the ground, a beast called in from the edge, a pop of smoke",
    time(X) {
      const T = { circle: [0.82, 1.45], rise: [0.85, 1.45], call: [0.72, 1.2], puff: [0.6, 1.1] }[X.shape];
      return { windup: 0.25, impacts: X.tos.map(() => T[0]), dur: T[1] };
    },
    spot(X, i) { const q = X.tos[i] || X.tos[0]; return q === X.from ? { x: X.from.x + X.dir * 26 * SCALE, y: X.from.y, h: 24 } : q; },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, S = X.S;
      X.tos.forEach((q0, i) => {
        const q = this.spot(X, i), imp = X.T.impacts[i], tt = u - imp;
        if (X.shape === "circle") {
          const grow = eOut(seg(u, 0.1, 0.5)), fade = 1 - seg(u, imp + 0.2, X.T.dur), r = 15 * k * grow;
          if (layer === "floor") {
            if (fade <= 0) return;
            gring(q.x, q.y, r, pal[3], fade, 1, 0); gring(q.x, q.y, r * 0.78, pal[2], fade, 1, 0); gring(q.x, q.y, r * 0.5, pal[3], fade * 0.8, 1, 6);
            for (let j = 0; j < 8; j++) { const a = j / 8 * TAU + u * 1.5; part("rune", q.x + Math.cos(a) * r * 0.9, q.y + Math.sin(a) * r * 0.9 * FLAT - 2, 1.2, 0, 1 - fade * grow, S.p === "rune" ? S : Object.assign({}, S, { acc: pal[4] }), j, u); }
            glowAt(q.x, q.y, r * 0.7, pal, fade * 0.6);
            return;
          }
          if (tt > -0.12 && tt < 0.35) {
            const w = (3 + 3 * k) * (tt < 0 ? 1 + tt / 0.12 : 1 - tt / 0.35);
            for (let x = -Math.ceil(w); x <= Math.ceil(w); x++) { const ar = Math.abs(x) / Math.max(0.5, w); for (let y = q.y - 70 * k; y < q.y; y++) Pa(q.x + x, y, ar < 0.35 ? pal[4] : ar < 0.7 ? pal[3] : pal[2], ar > 0.7 ? 0.5 : 0.9); }
          }
          rise(X, q, u, 0.3, X.T.dur, 10, S.p === "fork" ? "spark" : S.p === "streak" ? "glint" : S.p, 12);
        } else if (X.shape === "rise") {
          if (layer === "floor") {
            const g = seg(u, 0.2, 0.6), fade = 1 - seg(u, imp + 0.3, X.T.dur);
            glowAt(q.x, q.y, 10 * k * g, pal, g * fade * 0.6);
            for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + 0.4, L = 12 * k * g; line(q.x, q.y, q.x + Math.cos(a) * L, q.y + Math.sin(a) * L * FLAT, STONE[0], fade); }
            return;
          }
          if (u > 0.5 && u < imp + 0.3) for (let j = 0; j < 8; j++) {
            const t2 = u - 0.5 - j * 0.03, v = hr(X.seed, j, 1, 40, 80) * k, a = -Math.PI / 2 + hr(X.seed, j, 2, -1, 1);
            if (t2 < 0 || t2 > 0.45) continue;
            const px = q.x + Math.cos(a) * v * t2, py = q.y + Math.sin(a) * v * t2 + 260 * t2 * t2;
            if (py < q.y + 2) { Rt(px, py, 2, 2, STONE[1]); P(px, py, STONE[2]); }
          }
          rise(X, q, u, 0.35, X.T.dur, 10, S.p === "tongue" ? "ember" : S.p, 10);
        } else if (X.shape === "call") {
          const from = { x: q.x - X.dir * 90 * SCALE, y: q.y }, v = seg(u, 0.2, imp);
          if (layer === "floor") return;
          for (let j = 0; j < 14; j++) { const w = v - j * 0.05; if (w <= 0) continue; part("dust", lerp(from.x, q.x, w), q.y - 2 - j * 0.3, 1.3 * k, 0, Math.min(0.99, (u - lerp(0.2, imp, w)) / 0.45), S, j); }
          if (tt > 0 && tt < 0.4) for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; part("dust", q.x + Math.cos(a) * (4 + tt * 30) * k, q.y + Math.sin(a) * 3 - 2, k * 1.2, 0, tt / 0.4, S, j); }
        } else {
          if (layer === "floor") return;
          if (tt > -0.05 && tt < 0.55) for (let j = 0; j < 12; j++) {
            const a = j / 12 * TAU + hs(X.seed, j, 1), life = seg(tt, -0.05, 0.5), d = (2 + 12 * eOut(life)) * k;
            blob(q.x + Math.cos(a) * d, q.y - hgt(q) * 0.5 + Math.sin(a) * d * 0.8 - life * 4, (4.5 + 3 * hs(X.seed, j, 2)) * k * (1 + life * 0.4), SMOKE, (1 - life) * 0.95);
          }
          if (tt > 0 && tt < 0.1) star(q.x, q.y - hgt(q) * 0.5, 7 * k, pal, 1);
          rise(X, q, u, imp, X.T.dur, 6, "glint", 10);
        }
      });
      if (layer === "fx") charge(X, u, layer, 0.02, X.T.windup);
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u < X.T.impacts[0]) { const q = seg(u, 0, 0.3); o.dy = -2 * q; o.tint = X.pal[3]; o.tintAmt = 0.18 * q * (u < X.T.impacts[0] - 0.1 ? 1 : 0); } return; }
      const imp = X.T.impacts[i] || X.T.impacts[0], tt = u - imp;
      if (X.shape === "circle") { o.alpha = seg(tt, -0.1, 0.12); o.white = tt < 0.18 ? 1 - seg(tt, 0.02, 0.18) : 0; }
      else if (X.shape === "rise") { const q = eOut(seg(u, 0.5, imp)); o.sy = Math.max(0.05, q); o.alpha = q > 0.05 ? 1 : 0; o.tint = X.pal[2]; o.tintAmt = 0.3 * (1 - seg(tt, 0, 0.4)); }
      else if (X.shape === "call") { const q = eOut(seg(u, 0.2, imp)); o.dx = -X.dir * 90 * SCALE * (1 - q); o.alpha = seg(u, 0.18, 0.3); o.dy = -Math.abs(Math.sin(u * 28)) * 2 * (1 - q); }
      else { o.alpha = tt > 0.02 ? 1 : 0; o.white = tt < 0.15 ? 1 - seg(tt, 0.03, 0.15) : 0; }
    },
    marks(X) {
      return X.tos.map((q0, i) => { const q = this.spot(X, i); return X.shape === "circle" ? { kind: "rune", x: q.x, y: q.y, at: X.T.impacts[i] + 0.3, opts: { size: 0.9, seed: X.seed, school: X.S.id } } : X.shape === "rise" ? { kind: "crack", x: q.x, y: q.y + 1, at: 0.6, opts: { size: 0.6, seed: X.seed } } : X.shape === "call" ? { kind: "skid", x: q.x, y: q.y, at: X.T.impacts[i], opts: { size: 0.6, flip: X.dir < 0 } } : null; }).filter(Boolean);
    },
  };

  // ===== curse: hexes, dread, blinding clouds, marks and binds =====
  function bigRune(idx, x, y, col, dark, a, sc) {
    const b = RUNES[mod(idx, RUNES.length)];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (b[j][i]) { Rt(x + i * sc - 1, y + j * sc - 1, sc + 2, sc + 2, dark); }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (b[j][i] && on(x + i * sc, y + j * sc, a)) Rt(x + i * sc, y + j * sc, sc, sc, col);
  }
  function band(X, q, y, r, a, front, style, ph) {
    const pal = X.pal, k = X.k;
    for (let m = 0; m < 22; m++) {
      const th = (front ? 0 : Math.PI) + (m / 21) * Math.PI, x = q.x + Math.cos(th) * r, yy = y + Math.sin(th) * r * 0.32 + Math.sin(th * 2 + ph) * 0.6;
      if (style === "chain") Pa(x, yy, m % 3 === 0 ? "#2a2a30" : m % 3 === 1 ? "#a8acb8" : "#e0e4ec", a);
      else if (style === "vine") { Pa(x, yy, front ? pal[1] : pal[0], a); if (front && m % 6 === 3) leaf(x, yy - 1, -Math.PI / 2 + th, pal, a, 0.7); if (front && m % 7 === 1) Pa(x, yy - 1, pal[3], a); }
      else if (style === "ice") { Pa(x, yy, front ? pal[3] : pal[2], a); if (front && m % 5 === 2) shard(x, yy, 3 * k, -Math.PI / 2 + (m % 2 ? 0.4 : -0.4), pal, a); }
      else if (style === "rune") { if (front && m % 5 === 2) part("rune", x, yy, 0.9, 0, 0, X.S, m, ph); else Pa(x, yy, pal[front ? 3 : 2], a); }
      else Pa(x + Math.sin(m + ph * 3) * 0.6, yy, front ? pal[3] : pal[2], a);
    }
  }
  // the lure: a kelpie's glamour, green as pondweed, shimmering like light on water
  const WEED = ["#0c2418", "#1c4a2c", "#3a7a3e", "#78b860", "#c8f0a0"], GLAM = ["#103a34", "#2a8a78", "#7ae8c8", "#d8fff0", "#ffffff"];
  function weed(x, y, h, u, j, seed, a) {
    for (let m = 0; m < h; m++) {
      const f = m / Math.max(1, h), sx = x + Math.sin(u * 5 + j * 1.7 + f * 3) * 2 * f;
      Pa(sx - 1, y - m, WEED[1], a); Pa(sx, y - m, m % 4 === 1 ? WEED[3] : WEED[2], a);
      if (m % 5 === 3) Pa(sx + (j % 2 ? 1 : -1), y - m, WEED[3], a);
    }
    if (h > 3) Pa(x + Math.sin(u * 5 + j * 1.7 + 3) * 2, y - h, WEED[4], a);
  }
  function glint(x, y, u, j, seed, a) {
    const ph = (u * 3 + hs(seed, j, 7)) % 1;
    if (ph < 0.5) Pa(x, y, ph < 0.2 ? GLAM[4] : GLAM[3], a);
    if (ph < 0.15) { Pa(x - 1, y, GLAM[2], a); Pa(x + 1, y, GLAM[2], a); Pa(x, y - 1, GLAM[2], a); Pa(x, y + 1, GLAM[2], a); }
  }
  function lure(X, u, layer) {
    const k = X.k, pal = X.pal, f = X.from, w = X.T.windup, fade = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
    if (layer === "floor") {
      for (let r = 0; r < 3; r++) { const t2 = u - r * 0.12; if (t2 > 0 && t2 < 0.6) gring(f.x, f.y, (4 + t2 * 40) * k, r ? pal[2] : pal[3], 1 - t2 / 0.6, 1, 0); }
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], v = eOut(seg(u, w, ti)), tt = u - ti;
        // a wake runs over the ground ahead of the glamour, ripples left behind it
        for (let j = 0; j < 7; j++) {
          const at = v - j * 0.07;
          if (at <= 0 || v <= 0 || tt > 0.6) continue;
          const x = lerp(f.x, q.x, at), y = lerp(f.y, q.y, at) + 1, a = (1 - j / 7) * (1 - seg(tt, 0, 0.6));
          gring(x, y, (2 + j * 0.8) * k, j ? pal[2] : pal[3], a, 1, 0, Math.PI * 0.1, Math.PI * 0.9);
        }
        if (tt > -0.1) { gdisc(q.x, q.y + 1, 11 * k, pal[2], 0.5 * fade * (X.P.miss ? 0.5 : 1)); if (tt > 0 && tt < 0.5) gring(q.x, q.y + 1, (6 + tt * 40) * k, pal[3], 1 - tt / 0.5, 1, 0); }
      });
      return;
    }
    const hd = head(f);
    for (let j = 0; j < 10; j++) {
      const t2 = seg(u, 0, w + 0.25), a = Math.sin(t2 * Math.PI);
      if (a > 0) glint(hd.x + hr(X.seed, j, 1, -9, 9) * k, hd.y + hr(X.seed, j, 2, -4, 14) * k, u, j, X.seed, a);
    }
    X.tos.forEach((q, i) => {
      const ti = X.T.impacts[i], tt = u - ti, c = chest(q), h = head(q), v = eOut(seg(u, w, ti));
      // the glamour: a ribbon of light that wavers out like a reflection and reaches for the chest
      if (v > 0 && tt < 0.25) {
        const s0 = X.src, path = (z) => [lerp(s0.x, c.x, z), lerp(s0.y, c.y, z) + Math.sin(z * Math.PI * 3 - u * 12) * 3 * k * Math.sin(z * Math.PI)];
        const a = 1 - seg(tt, 0, 0.25);
        for (let m = 0; m < 44; m++) {
          const z = v - m * 0.01;
          if (z < 0) break;
          const [x, y] = path(z), am = a * (1 - m / 46), lit = (fl(u * 24) + m) % 4 === 0;
          Pa(x, y - 1, m < 4 || lit ? GLAM[4] : GLAM[3], am); Pa(x, y, m < 14 ? GLAM[3] : GLAM[2], am); Pa(x, y + 1, GLAM[1], am * 0.8);
          if (m % 7 === 3) star(x, y - 3 - Math.sin(u * 9 + m) * 2, 2, GLAM, am * (lit ? 1 : 0.6));
          if (m % 9 === 4 && (fl(u * 10) + m) % 3 === 0) drip(x, y + 4 + (u * 30 % 4), 2, pal, am * 0.8);
        }
      }
      if (tt < 0) return;
      // weed rises round the legs; a charmed foe stands in it swaying, the rest shake it off
      const grow = eOut(seg(tt, 0, 0.3)) * (X.P.miss ? 0.5 * (1 - seg(tt, 0.25, 0.5)) : 1), hh = hgt(q);
      for (let j = 0; j < 5; j++) {
        const bx = q.x + (j - 2) * 3.2 * k, top = rnd(hh * hr(X.seed, j + i * 7, 3, 0.35, 0.7) * grow);
        if (top > 0) weed(bx, q.y, top, u, j + i, X.seed, fade);
      }
      if (X.P.miss) return;
      for (let j = 0; j < 8; j++) glint(q.x + hr(X.seed, j + i * 11, 4, -8, 8) * k, q.y - hr(X.seed, j + i * 11, 5, 4, hh) , u, j + 40, X.seed, fade * (1 - seg(tt, 0.6, 1)));
      if (tt < 0.08) star(c.x, c.y, 5 * k, GLAM, 1 - tt / 0.08);
      for (let j = 0; j < 2; j++) { const ph = seg(tt, 0.1 + j * 0.2, 0.9 + j * 0.2); if (ph > 0 && ph < 1) part("heart", h.x + (j ? 5 : -4), h.y - 3 - ph * 12, 1, 0, ph, { pal: GLAM }, j); }
    });
  }
  function fizzle(X, u) {
    X.tos.forEach((q, i) => {
      const tt = u - X.T.impacts[i], c = chest(q);
      if (tt < -0.02 || tt > 0.5) return;
      const a = 1 - seg(tt, 0.1, 0.5);
      for (let j = 0; j < 8; j++) {
        const ang = j / 8 * TAU + hs(X.seed, j + i * 9, 1), d = (3 + tt * 22) * X.k;
        Pa(c.x + Math.cos(ang) * d, c.y - 6 + Math.sin(ang) * d * 0.6 + tt * tt * 40, j % 2 ? X.pal[2] : X.pal[1], a);
      }
      for (let j = 0; j < 3; j++) part("smoke", c.x + (j - 1) * 4 * X.k, c.y - 8 - tt * 12, 0.6, 0, seg(tt, 0, 0.5), X.S, j, u);
    });
  }
  const BIND_STYLE = { wild: "vine", beast: "vine", frost: "ice", arcane: "rune", lore: "rune", holy: "rune", blade: "chain", craft: "chain", command: "chain", shield: "chain", physical: "chain", road: "chain", trade: "chain" };
  FAM.curse = {
    shapes: ["hex", "dread", "cloud", "mark", "bind", "lure"], arc: 0.3,
    about: "debuffs and fear: a sigil drops into the foe, a dread pulse rolls out, a blinding cloud, a reticle closes, binds coil up, a glamour lures",
    time(X) {
      if (X.shape === "lure") { const ts = X.tos.map((q) => 0.62 + Math.abs(q.x - X.from.x) / 230); return { windup: 0.32, impacts: ts, dur: Math.max(...ts) + 0.95 }; }
      if (X.shape === "dread") { const ts = byDist(X, X.from.x, X.from.y, 200, 0.35); return { windup: 0.28, impacts: ts, dur: Math.max(...ts) + 0.75 }; }
      if (X.shape === "cloud") return { windup: 0.3, impacts: X.tos.map((q, i) => 0.55 + i * 0.04), dur: 1.5 };
      if (X.shape === "bind") return { windup: 0.25, impacts: X.tos.map((q, i) => 0.55 + i * 0.06), dur: 1.25 + X.tos.length * 0.06 };
      return { windup: 0.25, impacts: X.tos.map((q, i) => 0.47 + i * 0.07), dur: 1.05 + X.tos.length * 0.07 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, S = X.S, dark = pal[0];
      if (X.shape === "lure") return lure(X, u, layer);
      // a status nobody fell for builds as usual, then fizzles at the foes instead of landing
      if (X.P.miss && u >= Math.min(...X.T.impacts) - 0.02) { if (layer === "fx") fizzle(X, u); return; }
      if (X.shape !== "dread") charge(X, u, layer, 0.02, X.T.windup);
      if (X.shape === "dread") {
        const tt = u - X.T.windup;
        if (layer === "floor") {
          for (let r = 0; r < 3; r++) { const t2 = tt - r * 0.12; if (t2 > 0 && t2 < 0.8) { const rr = t2 * 200 * k, a = 1 - t2 / 0.8; gring(X.from.x, X.from.y, rr, pal[0], a, r ? 2 : 3, 0); gring(X.from.x, X.from.y, rr + 1, r ? pal[1] : pal[2], a, 1, r === 2 ? 10 : 0); } }
          if (tt > 0 && tt < 0.4) glowAt(X.from.x, X.from.y, 14 * k, [pal[0], pal[0], pal[0]], 0.6 * (1 - tt / 0.4));
          return;
        }
        if (tt > 0 && tt < 0.8) {
          const rr = tt * 200 * k, wf = 1 - tt / 0.8;
          for (let j = 0; j < 26; j++) {
            const a2 = j / 26 * TAU + 0.1, x = X.from.x + Math.cos(a2) * rr, y = X.from.y + Math.sin(a2) * rr * FLAT, hh = (6 + 6 * hs(X.seed, j, 3)) * k * wf;
            tongue(x, y - hh * 0.35, Math.min(3, hh * 0.3), -Math.PI / 2 + Math.sin(u * 12 + j) * 0.3, wf * 0.8, [pal[0], pal[0], pal[1], pal[2], pal[3]], 1);
          }
        }
        if (tt > 0 && tt < 0.5) for (let j = 0; j < 10; j++) { const a = j / 10 * TAU, d = (6 + tt * 60) * k; part("wisp", X.src.x + Math.cos(a) * d, X.src.y + Math.sin(a) * d * 0.6, k, a + Math.PI, tt / 0.5, S, j, u); }
        X.tos.forEach((q, i) => {
          const t3 = u - X.T.impacts[i], h = head(q);
          if (t3 < 0 || t3 > 0.7) return;
          if (S.q === "skull" || S.id === "shadow" || S.id === "death") { bmp(BMP.skull, h.x - 2, h.y - 8 - t3 * 6, pal[3], 1 - seg(t3, 0.45, 0.7)); P(h.x - 1, h.y - 6 - t3 * 6, dark); P(h.x + 1, h.y - 6 - t3 * 6, dark); }
          else { Rt(h.x, h.y - 10 - t3 * 6, 1, 3, pal[3]); P(h.x, h.y - 6 - t3 * 6, pal[3]); }
          for (let j = 0; j < 2; j++) drip(h.x + (j ? 5 : -5), h.y + 2 + t3 * 10, 2, ["#5a8ab0", "#7aa8d0", "#a8d0f0", "#d8f0ff", "#ffffff"], 1 - t3 / 0.7);
        });
        return;
      }
      if (X.shape === "cloud") {
        if (layer === "floor") return;
        X.tos.forEach((q, i) => {
          cloud(X, q.x, q.y - hgt(q) * 0.82, 10 * k, u, 0.3 + i * 0.04, X.T.dur, 0.35);
          const t3 = u - X.T.impacts[i], h = head(q);
          if (t3 > 0 && t3 < 0.8) bmp(BMP.q, h.x - 1, h.y - 10 - Math.sin(t3 * 8) * 1.5, "#f6ebd0", 1 - seg(t3, 0.55, 0.8));
        });
        return;
      }
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, c = chest(q), h = head(q);
        if (X.shape === "hex") {
          if (layer === "floor") { if (tt > -0.25 && tt < 0.5) glowAt(q.x, q.y, 8 * k, [dark, dark, pal[1]], tt < 0 ? 0.5 : 0.7 * (1 - tt / 0.5)); return; }
          if (tt < 0 && u > 0.12) {
            const v = seg(u, 0.12, ti), y = h.y - 18 * k + v * 6, sc = k > 1.2 ? 3 : 2, idx = X.seed + i + (fl(u * 8) % 2);
            bigRune(Math.abs(idx), q.x - 2.5 * sc, y - 2.5 * sc, pal[3], dark, Math.min(1, v * 3), sc);
            for (let j = 0; j < 3; j++) { const ph = (u * 2 + j / 3) % 1; drip(q.x + (j - 1) * 3 * sc, y + 2.5 * sc + ph * 10, 2, [dark, pal[1], pal[2], pal[2], pal[3]], 1 - ph); }
          } else if (tt >= 0 && tt < 0.18) {
            const sz = (1 - tt / 0.18);
            for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, r = 14 * k * sz; line(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.x + Math.cos(a) * r * 0.5, c.y + Math.sin(a) * r * 0.5, pal[3], sz); }
          }
          burst(X, c.x, c.y, tt, X.dir, 0.9, "wisp");
        } else if (X.shape === "mark") {
          if (layer === "floor") return;
          const close = eOut(seg(u, 0.15, ti)), r = (16 - 9 * close) * k, spin = (1 - close) * 1.4, a = Math.min(1, u * 6) * (1 - seg(u, X.T.dur - 0.25, X.T.dur));
          const red = ["#4a0c0c", "#a01c1c", "#e8402c", "#ff9a7a", "#ffffff"];
          for (let j = 0; j < 4; j++) {
            const th = j * Math.PI / 2 + Math.PI / 4 + spin, cx = c.x + Math.cos(th) * r, cy = c.y + Math.sin(th) * r, sx = Math.cos(th) > 0 ? -1 : 1, sy = Math.sin(th) > 0 ? -1 : 1;
            if (tt < 0.15) { line(cx, cy, cx + sx * 3 * k, cy, red[2], a); line(cx, cy, cx, cy + sy * 3 * k, red[2], a); }
          }
          if (tt >= 0) {
            const my = h.y - 6 - Math.sin(u * 6) * 1, s = tt < 0.08 ? 4 : 3;
            poly([[q.x, my - s], [q.x + s, my], [q.x, my + s], [q.x - s, my]], red[2], a); poly([[q.x, my - s + 1.5], [q.x + s - 1.5, my], [q.x, my + s - 1.5], [q.x - s + 1.5, my]], red[3], a);
            if (tt < 0.1) star(c.x, c.y, 6 * k, red, 1 - tt / 0.1);
          }
        } else if (X.shape === "bind") {
          const style = BIND_STYLE[S.id] || "wisp", n = 3, fade = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
          for (let j = 0; j < n; j++) {
            const st = ti - 0.3 + j * 0.06, v = eOut(seg(u, st, ti + j * 0.04));
            if (v <= 0) continue;
            const y = q.y - 1 - v * (hgt(q) * (0.18 + j * 0.2)), r = (11 - 4 * v + (j === 1 ? 0.5 : 0)) * k;
            band(X, q, y, r, fade, layer === "fx", style, u * 2 + j);
            band(X, q, y + 1, r, fade * 0.8, layer === "fx", style === "rune" || style === "ice" ? "plain" : style, u * 2 + j + 0.5);
          }
          if (layer === "fx" && tt >= 0 && tt < 0.12) star(c.x, c.y, 5 * k, pal, 1 - tt / 0.12);
          if (layer === "floor" && style === "vine") for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; line(q.x, q.y, q.x + Math.cos(a) * 9 * k * seg(u, ti - 0.35, ti - 0.1), q.y + Math.sin(a) * 3 * k * seg(u, ti - 0.35, ti - 0.1), pal[1], fade); }
        }
      });
    },
    pose(X, role, u, i, o) {
      if (X.shape === "lure") {
        if (role === "actor") { const q = seg(u, 0, X.T.windup + 0.2); o.dy = -1.5 * Math.sin(q * Math.PI); o.tint = GLAM[2]; o.tintAmt = 0.14 * Math.sin(q * Math.PI); return; }
        const tt = u - X.T.impacts[i];
        if (tt < 0) return;
        if (X.P.miss) { if (tt < 0.3) o.dx = tdir(X, i) * 1.5 * Math.sin(tt / 0.3 * Math.PI); return; }
        const held = sm(seg(tt, 0, 0.35)) * (1 - seg(u, X.T.dur - 0.3, X.T.dur));
        o.dx = -tdir(X, i) * 2.5 * held * SCALE + Math.sin(u * 5) * 0.6 * held; o.tint = GLAM[2]; o.tintAmt = 0.16 * held; if (tt < 0.05) o.white = 0.5;
        return;
      }
      if (X.P.miss && role === "target") return;
      if (role === "actor") {
        if (X.shape === "dread") { const q = seg(u, 0.05, X.T.windup + 0.2); o.sy = 1 + 0.07 * Math.sin(q * Math.PI); o.sx = 1 + 0.05 * Math.sin(q * Math.PI); o.tint = X.pal[0]; o.tintAmt = 0.4 * Math.sin(q * Math.PI); }
        else if (u < X.T.windup + 0.05) { o.dy = -1.2; o.tint = X.pal[2]; o.tintAmt = 0.15; }
        return;
      }
      const tt = u - X.T.impacts[i];
      if (tt < 0) return;
      if (X.shape === "dread") { if (tt < 0.6) { o.dx = Math.sin(u * 90) * 1.2 * (1 - tt / 0.6) - tdir(X, i) * -2 * Math.min(1, tt / 0.1) * (1 - seg(tt, 0.3, 0.6)); o.sy = 0.96; } return; }
      if (X.shape === "bind") { if (u < X.T.dur - 0.2) { o.sx = 0.93; o.dx = Math.sin(u * 40) * 0.5; } if (tt < 0.06) o.white = 0.8; return; }
      if (X.shape === "mark") { if (tt < 0.08) o.white = 0.7; return; }
      if (tt < 0.5) { o.tint = X.pal[1]; o.tintAmt = 0.55 * (1 - tt / 0.5); if (tt < 0.06) o.white = 0.6; o.dx = tdir(X, i) * 1.5 * Math.sin(Math.min(1, tt / 0.2) * Math.PI); }
    },
    marks(X) {
      if (X.P.miss) return [];
      if (X.shape === "lure") return X.tos.map((q, i) => ({ kind: "puddle", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.7, seed: X.seed + i, school: "water" } }));
      if (X.shape === "bind" && (BIND_STYLE[X.S.id] === "vine" || X.S.id === "frost")) return X.tos.map((q, i) => ({ kind: X.S.id === "frost" ? "frost" : "vines", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.7, seed: X.seed + i, school: X.S.id } }));
      if (X.shape === "hex") return X.tos.map((q, i) => ({ kind: "soot", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.5, seed: X.seed + i, school: X.S.id } }));
      return [];
    },
  };

  // ===== guard: a plate, a wall, a bubble or a parry flash in front of the guard =====
  FAM.guard = {
    shapes: ["shield", "wall", "dome", "parry"], arc: 0,
    about: "defence: a shield plate flashes up, a wall rises, a bubble closes, a parry rings out",
    time(X) {
      if (X.shape === "parry") return { windup: 0.08, impacts: X.tos.map(() => 0.16), dur: 0.5 };
      if (X.shape === "wall") return { windup: 0.12, impacts: X.tos.map(() => 0.32), dur: 0.95 };
      return { windup: 0.1, impacts: X.tos.map((q, i) => 0.26 + i * 0.05), dur: 0.85 + X.tos.length * 0.05 };
    },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, S = X.S;
      X.tos.forEach((q, i) => {
        const imp = X.T.impacts[i], c = chest(q), d = q === X.from ? X.dir : tdir(X, i), fade = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
        if (X.shape === "shield") {
          if (layer === "floor") { if (u > imp - 0.1) gring(q.x + d * 9 * k, q.y, 5 * k, pal[2], fade * 0.7, 1, 0); return; }
          const pop = eOut3(seg(u, imp - 0.12, imp)), sz = (0.5 + 0.5 * pop) * k, x = c.x + d * 12 * k, y = c.y - 1;
          if (pop <= 0) return;
          const w = 9 * sz, hh = 12 * sz, pts = [[x, y - hh], [x + w * 0.7, y - hh * 0.75], [x + w * 0.7, y + hh * 0.1], [x, y + hh], [x - w * 0.7, y + hh * 0.1], [x - w * 0.7, y - hh * 0.75]];
          const out = pts.map(([px, py]) => [x + (px - x) * 1.15, y + (py - y) * 1.1]);
          halo(x, y, hh * 1.1, pal, fade * 0.35);
          poly(out, pal[0], fade);
          poly(pts, pal[1], fade);
          poly(pts.map(([px, py]) => [x + (px - x) * 0.8, y + (py - y) * 0.82]), pal[2], fade);
          poly(pts.map(([px, py]) => [x + (px - x) * 0.4 - w * 0.12, y + (py - y) * 0.45 - hh * 0.2]), pal[3], fade);
          for (let j = 0; j < 6; j++) line(pts[j][0], pts[j][1], pts[(j + 1) % 6][0], pts[(j + 1) % 6][1], j < 2 ? pal[4] : j < 4 ? pal[3] : pal[1], fade);
          const gl = seg(u, imp, imp + 0.25);
          if (gl > 0 && gl < 1) { const gy = y - hh * 0.75 + gl * hh * 1.6; line(x - w * 0.6, gy, x + w * 0.6, gy - 3, pal[4], fade); line(x - w * 0.6, gy + 1, x + w * 0.6, gy - 2, pal[4], fade * 0.6); }
          if (u > imp && u < imp + 0.1) star(x + d * 1, y - hh * 0.6, 4 * k, pal, 1);
        } else if (X.shape === "wall") {
          const rise = eOut(seg(u, X.T.windup, imp)), H = 20 * k * rise, x = q.x + d * 13 * k, w = 3 * k;
          if (layer === "floor") { if (rise > 0) { gdisc(x, q.y, 7 * k, "rgba(20,14,10,0.5)", fade * 0.5); for (let j = 0; j < 5; j++) part("dust", x + (j - 2) * 3, q.y, k, 0, seg(u, imp - 0.1, imp + 0.4), S, j); } return; }
          if (H < 1) return;
          if (S.id === "frost") { for (let j = -2; j <= 2; j++) shard(x + j * 2.2 * k, q.y, H * (1 - Math.abs(j) * 0.18), -Math.PI / 2 + j * 0.08, pal, fade); }
          else if (S.id === "flame" || S.id === "hearth") { for (let j = -2; j <= 2; j++) tongue(x + j * 2 * k, q.y - H * 0.35 * (1 - Math.abs(j) * 0.2) + Math.sin(u * 20 + j) * 1, 2.4 * k * rise, -Math.PI / 2 + Math.sin(u * 15 + j) * 0.2, 0.8, pal, fade); }
          else if (S.id === "wild") { for (let j = -2; j <= 2; j++) { for (let m = 0; m < H; m++) Pa(x + j * 2 * k + Math.sin(m * 0.4 + j) * 1.2, q.y - m, m % 4 ? pal[1] : pal[2], fade); thorn(x + j * 2 * k, q.y - H * 0.6, j % 2 ? 0 : Math.PI, pal, fade); leaf(x + j * 2 * k, q.y - H, -1.2, pal, fade, 0.8); } }
          else {
            const glow = S.id === "holy" || S.id === "arcane" || S.id === "lore" || S.id === "healing" || S.id === "storm";
            const cols = glow ? [pal[1], pal[2], pal[3], pal[4]] : S.id === "shield" || S.id === "blade" || S.id === "command" ? ["#4a3a28", "#8a6a44", "#b8925c", "#e0c08a"] : STONE;
            for (let yy = 0; yy < H; yy++) for (let xx = -w; xx <= w; xx++) {
              const edge = Math.abs(xx) >= w - 0.5, col = edge ? cols[0] : yy % 6 === 0 ? cols[1] : xx < 0 ? cols[3] : cols[2];
              Pa(x + xx, q.y - yy, col, glow ? fade * 0.75 : fade);
            }
            if (glow) for (let j = 0; j < 3; j++) part("rune", x, q.y - H * (0.25 + j * 0.3), 1.2, 0, 0, S, j + X.seed, u);
            line(x - w, q.y - H, x + w, q.y - H, cols[3], fade);
          }
        } else if (X.shape === "dome") {
          const pop = eOut3(seg(u, X.T.windup, imp)), rx = 14 * k * (0.6 + 0.4 * pop), ry = hgt(q) * 0.66 * (0.6 + 0.4 * pop), cy = q.y - ry * 0.8;
          if (pop <= 0) return;
          if (layer === "floor") {
            gring(q.x, q.y, rx, pal[3], fade, 1, 0);
            glowAt(q.x, q.y, rx * 0.9, pal, fade * 0.5);
            for (let m = 0; m < 48; m++) { const th = m / 48 * TAU; if (Math.sin(th) < 0.2) continue; Pa(q.x + Math.cos(th) * rx, cy - Math.sin(th) * ry, pal[2], fade * 0.45); }
            return;
          }
          for (let yy = Math.ceil(cy - ry); yy < q.y; yy++) { const t2 = (yy - cy) / ry, hw = rx * Math.sqrt(Math.max(0, 1 - t2 * t2)); for (let xx = -hw; xx <= hw; xx += 1) if ((fl(xx) + yy + fl(u * 8)) % 7 === 0) Pa(q.x + xx, yy, pal[3], fade * 0.5); }
          const n = 64, shim = u * 3;
          for (let m = 0; m < n; m++) {
            const th = m / n * TAU, px = q.x + Math.cos(th) * rx, py = cy + Math.sin(th) * ry;
            if (py > q.y) continue;
            const lit = Math.cos(th + 2.2) > 0.55, tw2 = (m + fl(shim * 6)) % 8 === 0;
            Pa(px, py, tw2 ? pal[4] : lit ? pal[3] : pal[2], fade);
            Pa(px - Math.cos(th), py - Math.sin(th), pal[2], fade * 0.6);
          }
          for (let j = 0; j < 6; j++) { const th = -Math.PI * (0.15 + j * 0.13) + Math.sin(shim + j) * 0.05; Pa(q.x + Math.cos(th) * rx * 0.7, cy + Math.sin(th) * ry * 0.7, pal[3], fade * 0.35); }
          const sw = seg(u, imp, imp + 0.3);
          if (sw > 0 && sw < 1) { const th = -Math.PI * (1 - sw); for (let r = 0; r < 3; r++) Pa(q.x + Math.cos(th) * (rx - r), cy + Math.sin(th) * (ry - r), pal[4], 1); }
        } else if (X.shape === "parry") {
          if (layer === "floor") return;
          const tt = u - imp, x = c.x + d * 7 * k, y = c.y - 3;
          if (tt < -0.08 || tt > 0.3) return;
          if (tt < 0) { const v = seg(tt, -0.08, 0); line(x - d * 6 * k + d * v * 4, y - 8 * k, x + d * v * 4, y + 2, pal[3], 1); return; }
          const a = 1 - tt / 0.3, L = 8 * k * (0.7 + 0.3 * eOut(Math.min(1, tt / 0.06)));
          for (const [sx2, sy2] of [[1, 1], [1, -1]]) { line(x - L * sx2 + 1, y - L * sy2 + 1, x + L * sx2 + 1, y + L * sy2 + 1, pal[0], a); line(x - L * sx2, y - L * sy2, x + L * sx2, y + L * sy2, pal[4], a); line(x - L * sx2 * 0.7, y - L * sy2 * 0.7 + 1, x + L * sx2 * 0.7, y + L * sy2 * 0.7 + 1, pal[2], a); }
          if (tt < 0.08) { halo(x, y, 9 * k, IMPACT, 0.9); star(x, y, 10 * k, IMPACT, 1); }
          burst(X, x, y, tt, d, 1.2, "spark");
        }
      });
    },
    pose(X, role, u, i, o) {
      if (role !== "actor" && X.tos[0] !== X.from) { const tt = u - X.T.impacts[i]; if (tt > 0 && tt < 0.3) { o.tint = X.pal[3]; o.tintAmt = 0.2 * (1 - tt / 0.3); } return; }
      if (role !== "actor") return;
      if (X.shape === "parry") { const tt = u - X.T.impacts[0]; o.dx = X.dir * (tt < 0 ? 2 * seg(u, 0, X.T.impacts[0]) : 2 - 4 * Math.min(1, tt / 0.08) * (1 - seg(tt, 0.1, 0.3))) * SCALE; return; }
      const q = seg(u, 0, X.T.impacts[0]);
      o.sx = 1 + 0.04 * q * (1 - seg(u, X.T.dur - 0.3, X.T.dur)); o.sy = 1 - 0.05 * q * (1 - seg(u, X.T.dur - 0.3, X.T.dur)); o.dx = -X.dir * q * (1 - seg(u, X.T.dur - 0.3, X.T.dur)) * SCALE;
    },
    marks(X) { return X.shape === "wall" ? [{ kind: X.S.id === "frost" ? "frost" : X.S.id === "flame" ? "scorch" : X.S.id === "wild" ? "vines" : "scuff", x: X.from.x + X.dir * 13 * X.k, y: X.from.y + 1, at: X.T.impacts[0], opts: { size: 0.5, seed: X.seed, school: X.S.id } }] : X.shape === "shield" ? [{ kind: "skid", x: X.from.x, y: X.from.y, at: X.T.impacts[0], opts: { size: 0.3, flip: X.dir > 0 } }] : []; },
  };

  // ===== the class rework's shapes: decoys, songs, puppet strings, dizzy spells, phantasms, mirrors, snares, traps, deadfalls =====
  // each joins an existing family (its timing conventions, sound and pose roles) and is dispatched by shape
  const EXT = {};
  function extend(fam, shape, def) { FAM[fam].shapes.push(shape); (EXT[fam] = EXT[fam] || {})[shape] = def; }
  const ROPE = ["#3a2814", "#7a5a30", "#b8945a", "#e4cc94", "#fff4d0"], IRON = ["#1e1c22", "#4a4852", "#8a8a96", "#c8ccd6", "#ffffff"];
  const LOG = ["#2a1a0e", "#5a3a1e", "#8a5e32", "#b88a52", "#e0c08a"];
  // a figure's outline, for the decoys: head, shoulders, a coat to the knees, two legs; fill(x, y, edge) paints each pixel
  function figure(x, y, h, fill) {
    const hr0 = h * 0.13, hy = y - h * 0.84, sh = h * 0.2;
    for (let yy = fl(hy - hr0); yy <= y; yy++) {
      const t = (yy - (y - h * 0.7)) / (h * 0.7);
      let hw = yy < hy + hr0 ? Math.sqrt(Math.max(0, hr0 * hr0 - (yy + 0.5 - hy) ** 2)) : yy < y - h * 0.7 ? hr0 * 0.6 : t < 0.62 ? sh - t * 0.05 * h : h * 0.15;
      const legs = t >= 0.62;
      for (let xx = fl(x - hw); xx <= x + hw; xx++) {
        if (legs && Math.abs(xx + 0.5 - x) < 1) continue;
        const edge = xx <= x - hw + 1 || xx >= x + hw - 1 || yy === fl(hy - hr0);
        fill(xx, yy, edge);
      }
    }
  }
  const glowC2 = (X) => X.S.acc || X.pal[3];
  const prism = (X, j, u) => ((fl(u * 10) + j) % 2 ? X.pal[2] : X.S.acc || X.pal[3]);

  extend("buff", "decoy", {
    time: (X) => ({ windup: 0.2, impacts: X.tos.map(() => 0.42), dur: 1.55 }),
    copies: (X) => Math.max(1, Math.min(4, X.P.count || 2)),
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, f = X.from, h = hgt(f), n = this.copies(X), end = X.T.dur, out = eOut(seg(u, 0.25, 0.55)), pop = seg(u, end - 0.4, end - 0.1);
      for (let j = 0; j < n; j++) {
        const side = j % 2 ? -1 : 1, x = f.x + side * (19 + 13 * fl(j / 2)) * k * out, a = seg(u, 0.25, 0.32) * (1 - pop), body = j % 2 ? pal[2] : X.S.acc || pal[3];
        if (layer === "floor") { if (a > 0) gdisc(x, f.y, 6 * k, pal[1], a * 0.45); continue; }
        if (a > 0 && !(pop > 0 && fl(u * 30 + j) % 2)) {
          // a copy is the hero in light: a dithered body, a lit rim on the left, scan lines that crawl down it
          figure(x, f.y, h, (xx, yy, edge) => {
            const scan = (yy + fl(u * 40)) % 4 === 0;
            if (edge) Pa(xx, yy, xx < x ? pal[4] : pal[1], a);
            else Pa(xx, yy, scan ? pal[4] : body, a * (scan ? 0.95 : 0.7));
          });
          Pa(x - 1, f.y - h * 0.85, pal[0], a); Pa(x + 2, f.y - h * 0.85, pal[0], a);
        }
        if (pop > 0 && pop < 1) for (let m = 0; m < 6; m++) { const ang = m / 6 * TAU + j; part("facet", x + Math.cos(ang) * pop * 10 * k, f.y - h * 0.5 + Math.sin(ang) * pop * 12 * k, 1.2, 0, pop, X.S, m + j, u); }
        // the split: streaks of light running from the hero out to each copy
        if (u > 0.22 && u < 0.6) for (let m = 0; m < 3; m++) { const yy = f.y - h * (0.3 + m * 0.25), q = seg(u, 0.22 + m * 0.03, 0.5); line(lerp(f.x, x, q * 0.4), yy, lerp(f.x, x, q), yy, pal[3], 1 - seg(u, 0.45, 0.6)); }
      }
      if (layer === "fx" && u > 0.38 && u < 0.5) star(f.x, f.y - h * 0.55, 6 * k, pal, 1 - seg(u, 0.38, 0.5));
    },
    pose(X, role, u, i, o) {
      if (role !== "actor" && X.tos[0] !== X.from) return;
      if (u > 0.3 && u < 0.6) { o.white = fl(u * 30) % 2 ? 0.5 : 0; o.alpha = 0.8; }
      o.tint = X.pal[3]; o.tintAmt = 0.2 * Math.sin(seg(u, 0.1, X.T.dur) * Math.PI);
    },
    marks: () => [],
  });

  // a stave of light runs out to each ally with the notes riding it; a big note lands over every head
  extend("buff", "anthem", {
    time(X) { const ts = byDist(X, X.from.x, X.from.y, 170, 0.4); return { windup: 0.3, impacts: ts, dur: Math.max(...ts) + 0.85 }; },
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, f = X.from, s = head(f), end = X.T.dur, fade = 1 - seg(u, end - 0.3, end);
      if (layer === "floor") {
        for (let r = 0; r < 2; r++) { const t2 = u - X.T.windup - r * 0.18; if (t2 > 0 && t2 < 0.7) gring(f.x, f.y, (6 + t2 * 90) * k, pal[3], 1 - t2 / 0.7, 1, 10); }
        return;
      }
      for (let j = 0; j < 5; j++) { const ph = (u * 1.4 + j / 5) % 1, a = Math.sin(seg(u, 0, X.T.windup + 0.2) * Math.PI); if (a > 0) part("note", s.x + Math.sin(j * 2.1 + u * 4) * 8 * k, s.y + 2 - ph * 16, 1.2, 0, ph, X.S, j, u); }
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], h = head(q), v = eOut(seg(u, X.T.windup, ti)), tt = u - ti;
        if (q !== f && v > 0 && tt < 0.3) {
          const a = fade * (1 - seg(tt, 0, 0.3)), path = (z) => [lerp(s.x, h.x, z), lerp(s.y + 2, h.y - 2, z) - Math.sin(z * Math.PI) * 10 * k + Math.sin(z * 14 - u * 10) * 1.5];
          for (let z = 0; z <= v; z += 0.012) { const [x, y] = path(z); for (const dy of [-3, 0, 3]) { Pa(x, y + dy * k * 0.7 + 1, pal[0], a * 0.5); Pa(x, y + dy * k * 0.7, dy ? pal[2] : pal[3], a * (0.55 + 0.45 * z / Math.max(0.01, v))); } }
          for (let m = 0; m < 3; m++) { const z = v - m * 0.12; if (z > 0) { const [x, y] = path(z); part("note", x, y - 1, m ? 1 : 1.6, 0, m * 0.15, X.S, m + i); } }
        }
        if (tt > 0 && tt < 0.7) {
          const a = 1 - seg(tt, 0.45, 0.7);
          bmpS(i % 2 ? BMP.note : BMP.note2, h.x - 3, h.y - 12 - tt * 10, pal[3], pal[0], a, 2);
          chevron(h.x, h.y - 2 - tt * 8, 3, pal[3], pal[1], a);
          if (tt < 0.15) { halo(h.x, h.y + 3, 7 * k, pal, 0.6 * (1 - tt / 0.15)); star(h.x + 5, h.y - 4, 4 * k, pal, 1 - tt / 0.15); }
        }
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { const q = seg(u, 0.05, X.T.windup + 0.3); o.rot = Math.sin(u * 18) * 0.05 * Math.sin(q * Math.PI); o.dy = -1.5 * Math.sin(q * Math.PI); return; }
      const tt = u - X.T.impacts[i];
      if (tt > -0.05 && tt < 0.5) { o.tint = X.pal[3]; o.tintAmt = 0.3 * (1 - seg(tt, 0, 0.5)); o.dy = tt > 0 && tt < 0.2 ? -2.5 * Math.sin(tt / 0.2 * Math.PI) * SCALE : 0; }
    },
    marks: () => [],
  });

  // a control bar drops over each foe on threads of light; the foe dances to it
  extend("curse", "strings", {
    time: (X) => ({ windup: 0.3, impacts: X.tos.map((q, i) => 0.6 + i * 0.06), dur: 1.55 + X.tos.length * 0.06 }),
    draw(X, u, layer) {
      if (layer === "floor") return;
      const k = X.k, pal = X.pal, end = X.T.dur, fade = 1 - seg(u, end - 0.3, end), s = X.src;
      if (u < 0.6) for (let j = 0; j < 4; j++) Pa(s.x + (j - 1.5) * 2, s.y - 2 - Math.abs(Math.sin(u * 20 + j)) * 2, pal[4], 1);
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, h = head(q), c = chest(q), drop = eOut(seg(u, ti - 0.3, ti)), sway = tt > 0 ? Math.sin(tt * 7 + i) * 0.35 : 0;
        if (drop <= 0) return;
        const by = h.y - 14 * k - (1 - drop) * 30, bx = q.x, w = 9 * k, ca = Math.cos(sway), sa = Math.sin(sway);
        const end0 = [bx - ca * w, by - sa * w], end1 = [bx + ca * w, by + sa * w];
        // threads from the caster's fingers to the bar, while it falls
        if (tt < 0.1) lineFn(s.x, s.y, bx, by, (v) => (on(lerp(s.x, bx, v), lerp(s.y, by, v), 0.35 * drop * (1 - seg(tt, 0, 0.1))) ? pal[3] : null));
        for (const [ex, ey, tx, ty] of [[end0[0], end0[1], c.x - 6 * k, c.y + 2], [end1[0], end1[1], c.x + 6 * k, c.y + 2], [bx, by, h.x, h.y]]) { line(ex + 1, ey, tx + 1 + (tt > 0 ? sway * 6 : 0), ty, pal[1], fade * 0.6); line(ex, ey, tx + (tt > 0 ? sway * 6 : 0), ty, pal[4], fade * 0.9); }
        line(end0[0], end0[1] + 1, end1[0], end1[1] + 1, LOG[1], fade); line(end0[0], end0[1], end1[0], end1[1], LOG[3], fade);
        line(bx - sa * 4, by - 4, bx + sa * 4, by + 4, LOG[2], fade);
        Pa(end0[0], end0[1], pal[4], fade); Pa(end1[0], end1[1], pal[4], fade);
        if (tt > 0 && tt < 0.12) star(h.x, h.y - 2, 5 * k, pal, 1 - tt / 0.12);
        if (tt > 0.1) { const ph = (tt * 0.8) % 1; part("heart", h.x + 6, h.y - 4 - ph * 10, 1, 0, ph, X.S, i); }
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { const q = seg(u, 0, X.T.windup + 0.3); o.dy = -1.2 * Math.sin(q * Math.PI); o.tint = X.pal[3]; o.tintAmt = 0.15 * Math.sin(q * Math.PI); return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0 || X.P.miss) return;
      const held = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
      o.dx = Math.sin(tt * 7 + i) * 2.4 * held * SCALE; o.dy = -Math.abs(Math.sin(tt * 7 + i)) * 1.5 * held; o.rot = Math.sin(tt * 7 + i) * 0.08 * held;
      o.tint = X.pal[2]; o.tintAmt = 0.18 * held; if (tt < 0.05) o.white = 0.6;
    },
    marks: () => [],
  });

  // the dizzy spell: a spiral turns over the face, stars and question marks circle the head
  extend("curse", "swirl", {
    time: (X) => ({ windup: 0.28, impacts: X.tos.map((q, i) => 0.55 + i * 0.06), dur: 1.45 + X.tos.length * 0.06 }),
    draw(X, u, layer) {
      if (layer === "floor") return;
      const k = X.k, pal = X.pal, end = X.T.dur, fade = 1 - seg(u, end - 0.3, end);
      charge(X, u, layer, 0.02, X.T.windup);
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, h = head(q);
        if (tt < -0.25) return;
        if (tt < 0) { const v = seg(tt, -0.25, 0); for (let m = 0; m < 4; m++) { const a = m / 4 * TAU + u * 9, r = (16 - 12 * v) * k; part("facet", h.x + Math.cos(a) * r, h.y + 4 + Math.sin(a) * r * 0.5, 1, 0, 0, X.S, m, u); } return; }
        const a0 = 1 - seg(tt, 0.9, 1.1), spin = -u * 9;
        for (let m = 0; m < 34; m++) { const t = m / 34 * 3.4 * Math.PI, r = (0.5 + t * 0.62) * k; Pa(h.x + Math.cos(t + spin) * r + 1, h.y + 5 + Math.sin(t + spin) * r * 0.8 + 1, pal[0], fade * a0 * 0.6); Pa(h.x + Math.cos(t + spin) * r, h.y + 5 + Math.sin(t + spin) * r * 0.8, m > 24 ? pal[2] : pal[4], fade * a0); }
        for (let m = 0; m < 4; m++) {
          const a = m / 4 * TAU + u * 5, x = h.x + Math.cos(a) * 12 * k, y = h.y - 4 + Math.sin(a) * 4 * k;
          if (m % 2) bmpS(m === 1 ? BMP.q : BMP.heart, x - 2, y - 4, m === 1 ? pal[4] : pal[2], pal[0], fade, m === 1 ? 2 : 1);
          else star(x, y, 3, m ? GLAM : pal, fade);
        }
        if (tt < 0.1) star(h.x, h.y + 4, 6 * k, pal, 1 - tt / 0.1);
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u < X.T.windup + 0.05) { o.dy = -1.2; o.tint = X.pal[2]; o.tintAmt = 0.15; } return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0 || X.P.miss) return;
      const held = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
      o.rot = Math.sin(tt * 9) * 0.1 * held; o.dx = Math.sin(tt * 4.5) * 1.5 * held; if (tt < 0.05) o.white = 0.6;
    },
    marks: () => [],
  });

  // a horror only the foe can see rises behind it: a looming head of smoke with lit eyes and a maw, hands reaching round
  extend("curse", "phantasm", {
    time: (X) => ({ windup: 0.3, impacts: X.tos.map((q, i) => 0.72 + i * 0.06), dur: 1.7 + X.tos.length * 0.06 }),
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, end = X.T.dur, horned = (X.P.count | 0) > 0;
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, d = tdir(X, i), rise = eOut(seg(u, ti - 0.42, ti + 0.05)), fade = 1 - seg(u, end - 0.4, end);
        if (rise <= 0) return;
        const H = hgt(q) * 1.5 * k * rise, cx = q.x + d * 7 * k, top = q.y - H - 8 * k, W = 15 * k, a = fade * Math.min(1, rise * 1.4);
        if (layer === "floor") {
          // a hooded wraith of smoke behind the foe: ragged robes from the ground up, a deep hood, a dark hollow for a face
          const ink = "#120a12", hy = top + W * 0.55;
          for (let yy = fl(top - W * 0.4); yy <= q.y; yy++) {
            const v = (yy - (top - W * 0.4)) / (q.y - top + W * 0.4), half = v < 0.25 ? W * (0.2 + v * 3) : W * (0.95 + (v - 0.25) * 0.5), rag = v > 0.8 ? Math.sin(yy * 1.7 + u * 9) * 3 : 0;
            for (let xx = fl(cx - half); xx <= cx + half + rag; xx++) {
              const e = Math.abs(xx - cx) / half;
              if (v > 0.85 && (xx + fl(u * 12)) % 3 === 0) continue;
              Pa(xx, yy, e > 0.82 ? (xx < cx ? pal[1] : ink) : e > 0.5 ? pal[0] : ink, a * (v > 0.75 ? 1 - (v - 0.75) * 2.2 : 1));
            }
          }
          if (horned) for (const s of [-1, 1]) { poly([[cx + s * W * 0.45, top + 2], [cx + s * W * 1.15, top - W * 0.75], [cx + s * W * 0.85, top + 4]], pal[0], a); line(cx + s * W * 0.5, top + 1, cx + s * W * 1.1, top - W * 0.7, pal[1], a); }
          for (let yy = -W * 0.42; yy <= W * 0.42; yy++) { const hw = W * 0.55 * Math.sqrt(1 - (yy / (W * 0.45)) ** 2); for (let xx = -hw; xx <= hw; xx++) Pa(cx + xx, hy + yy, "#06040a", a); }
          gdisc(q.x, q.y, 14 * k, ink, 0.6 * a);
          return;
        }
        // eyes burning in the hollow, the glow the illusion's second colour; on the impact a maw of pale fangs opens under them
        const ey = top + W * 0.42, open = tt > 0 ? Math.min(1, tt / 0.12) * (1 - seg(tt, 0.6, 0.9)) : 0, eyeA = a * (tt > -0.2 ? 1 : 0.5), glowC = X.S.acc || pal[3];
        for (const s of [-1, 1]) {
          const ex = cx + s * W * 0.24;
          halo(ex, ey, 3.5 * k, [pal[0], pal[1], glowC, glowC], eyeA * 0.7);
          poly([[ex - 2.2 * k, ey - s * 0.8], [ex + 2.2 * k, ey + s * 0.8 - 1], [ex, ey + 1.4 * k]], glowC, eyeA);
          Pa(ex, ey, "#ffffff", eyeA);
        }
        if (open > 0) {
          const my = top + W * 0.72, mw = W * 0.34, mh = 5 * k * open;
          for (let m = 0; m < 5; m++) { const x = cx - mw + m * mw * 0.5; poly([[x - 1.2, my], [x + 1.2, my], [x, my + 2.4 * k]], "#efe6d4", a); poly([[x + mw * 0.25 - 1, my + mh], [x + mw * 0.25 + 1, my + mh], [x + mw * 0.25, my + mh - 2 * k]], "#d8ccb8", a * open); }
        }
        // two long hands reach round the foe
        for (const s of [-1, 1]) {
          const reach = seg(u, ti - 0.15, ti + 0.15), sx = cx + s * W * 0.9, sy = top + W * 1.3, tx = q.x + s * 9 * k, ty = q.y - hgt(q) * 0.45;
          if (reach > 0) for (let m = 0; m < 3; m++) line(sx, sy + m, lerp(sx, tx, reach), lerp(sy, ty, reach) + m - 1, m === 1 ? pal[1] : "#120a12", a * 0.9);
          if (reach >= 1) for (let m = 0; m < 3; m++) { line(tx, ty, tx - s * (2 + m), ty + 3 + m, "#120a12", a); Pa(tx - s * (2 + m), ty + 3 + m, glowC2(X), a); }
        }
        for (let j = 0; j < 6; j++) { const ph = (u * 0.9 + j / 6) % 1; part("wisp", cx + hr(X.seed, j, 1, -1, 1) * W, top + W * 0.4 - ph * 16, k, -Math.PI / 2, ph, X.S, j, u); }
        if (tt > 0 && tt < 0.7) for (let j = 0; j < 2; j++) drip(head(q).x + (j ? 5 : -5), head(q).y + 2 + tt * 10, 2, ["#5a8ab0", "#7aa8d0", "#a8d0f0", "#d8f0ff", "#ffffff"], 1 - tt / 0.7);
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { const q = seg(u, 0.05, X.T.windup + 0.3); o.tint = X.pal[1]; o.tintAmt = 0.3 * Math.sin(q * Math.PI); o.sy = 1 + 0.05 * Math.sin(q * Math.PI); return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0 || X.P.miss) return;
      const held = 1 - seg(u, X.T.dur - 0.4, X.T.dur);
      o.sy = 1 - 0.07 * held; o.sx = 1 + 0.03 * held; o.dx = (Math.sin(u * 70) * 0.8 + tdir(X, i) * -2.5) * held; if (tt < 0.05) o.white = 0.7;
    },
    marks: () => [],
  });

  // panes of glass stand round each foe and flash; every one shows the wrong reflection, then they shatter
  extend("curse", "mirrors", {
    time: (X) => ({ windup: 0.3, impacts: X.tos.map((q, i) => 0.58 + i * 0.05), dur: 1.5 + X.tos.length * 0.05 }),
    draw(X, u, layer) {
      const k = X.k, pal = X.pal, end = X.T.dur;
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, grow = eOut(seg(u, ti - 0.3, ti)), crack = seg(u, end - 0.5, end - 0.2), h = hgt(q) * 1.1;
        if (grow <= 0) return;
        for (let m = 0; m < 4; m++) {
          const ang = (m / 4) * TAU + 0.4 + i, x = q.x + Math.cos(ang) * 13 * k, back = Math.sin(ang) < 0;
          if ((layer === "floor") !== back) continue;
          const y = q.y + Math.sin(ang) * 4 * k, H = h * 0.9 * grow, w = 3.5 * k;
          if (crack <= 0) {
            const GLASS = ["#5a7a90", "#9ab8cc", "#c8dce8", "#e8f4fa"];
            for (let yy = 0; yy < H; yy++) for (let xx = -w; xx <= w; xx++) {
              const frame = Math.abs(xx) >= w - 0.5 || yy >= H - 1 || yy === 0, sweep = Math.abs(((yy - xx * 2) / H) - ((u * 1.4 + m * 0.35) % 1.6)) < 0.07;
              const ghost = Math.abs(xx) < w * 0.5 && yy > H * 0.25 && yy < H * 0.8;
              const col = frame ? (xx < 0 || yy >= H - 1 ? "#e0b450" : "#8a6424") : sweep ? "#ffffff" : ghost ? (m % 2 ? pal[1] : GLASS[0]) : xx < 0 ? GLASS[3] : GLASS[2];
              Pa(x + xx, y - yy, col, frame ? 1 : 0.85);
            }
            Pa(x - w + 1, y - H + 2, prism(X, m, u), 1);
          } else for (let j = 0; j < 6; j++) { const life = crack, ox = hr(X.seed, j + m * 7, 1, -1, 1) * 14 * life, oy = -H * hr(X.seed, j + m * 7, 2, 0.1, 0.9) + life * life * 30; part("facet", x + ox, y + oy, 1.1, 0, life, X.S, j + m, u); }
        }
        if (layer === "fx" && tt > 0 && tt < 0.3) { star(q.x, q.y - h * 0.6, 7 * k * (1 - tt / 0.3), GLAM, 1 - tt / 0.3); }
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u < X.T.windup + 0.1) { o.dy = -1.2; o.tint = X.pal[3]; o.tintAmt = 0.2; } return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0 || X.P.miss) return;
      const held = 1 - seg(u, X.T.dur - 0.5, X.T.dur);
      o.dx = (fl(tt * 5) % 2 ? 1.5 : -1.5) * held; o.tint = X.pal[3]; o.tintAmt = 0.25 * held; if (tt < 0.08) o.white = 0.8;
    },
    marks: () => [],
  });

  // a loop lies hidden on the ground round the feet, then jerks tight round the ankles
  extend("curse", "snare", {
    time: (X) => ({ windup: 0.25, impacts: X.tos.map((q, i) => 0.55 + i * 0.06), dur: 1.3 + X.tos.length * 0.06 }),
    draw(X, u, layer) {
      const k = X.k, wild = X.S.id === "wild", R = wild ? X.pal : ROPE, end = X.T.dur, fade = 1 - seg(u, end - 0.3, end);
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, show = seg(u, ti - 0.35, ti - 0.2);
        if (show <= 0) return;
        const r = (tt < 0 ? 12 : lerp(12, 4, eOut(Math.min(1, tt / 0.1)))) * k, lift = tt > 0 ? Math.min(1, tt / 0.1) * 2 : 0;
        if (layer === "floor") {
          if (tt < 0.05) for (let m = 0; m < 48; m++) { const th = m / 48 * TAU, x = q.x + Math.cos(th) * r, y = q.y + Math.sin(th) * r * FLAT; Pa(x, y + 1, R[0], show * fade); Pa(x, y, m % 4 === 0 ? R[3] : R[2], show * fade); }
          // the line runs off to a stake at the edge
          const sx = q.x - tdir(X, i) * 22 * k;
          line(sx, q.y + 3, q.x - tdir(X, i) * r, q.y + 2 - lift, R[0], show * fade); line(sx, q.y + 2, q.x - tdir(X, i) * r, q.y + 1 - lift, R[2], show * fade); Rt(sx - 1, q.y - 3, 2, 5, LOG[1]); P(sx - 1, q.y - 3, LOG[3]);
          return;
        }
        if (tt < 0) return;
        for (let b = 0; b < 2; b++) {
          const y = q.y - 2 - b * 3 - lift, rr = r * (1 - b * 0.1);
          for (let m = 0; m < 22; m++) { const th = m / 21 * Math.PI, x = q.x + Math.cos(th) * rr, yy = y + Math.sin(th) * rr * 0.32; Pa(x, yy + 1, R[0], fade); Pa(x, yy, m % 3 === 0 ? R[3] : R[2], fade); if (wild && m % 5 === 2) thorn(x, yy, -Math.PI / 2, X.pal, fade); }
        }
        if (tt < 0.25) for (let m = 0; m < 5; m++) { const a = m / 5 * Math.PI + Math.PI; part("dust", q.x + Math.cos(a) * 9 * k, q.y + 1, k, 0, tt / 0.25, X.S, m); }
        if (tt < 0.1) star(q.x, q.y - 4, 5 * k, wild ? X.pal : ROPE, 1 - tt / 0.1);
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u > X.T.windup && u < X.T.windup + 0.35) o.dx = -X.dir * 2 * Math.sin(seg(u, X.T.windup, X.T.windup + 0.35) * Math.PI) * SCALE; return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0 || X.P.miss) return;
      if (tt < 0.12) { o.dy = -2 * Math.sin(tt / 0.12 * Math.PI); o.sy = 0.94; o.white = tt < 0.04 ? 0.7 : 0; }
      else if (u < X.T.dur - 0.25) { o.sx = 0.95; o.dx = Math.sin(u * 30) * 0.6; }
    },
    marks(X) { return X.P.miss ? [] : X.tos.map((q, i) => ({ kind: X.S.id === "wild" ? "vines" : "scuff", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.6, seed: X.seed + i, school: X.S.id } })); },
  });

  // a steel trap is tossed under the foe and its jaws snap shut on the shins
  function jaws(x, y, close, a, k) {
    const rx = lerp(11, 7.5, close) * k, ry = lerp(3, 7, close) * k, cy = y - lerp(0, 6.5, close) * k;
    for (let m = 0; m < 72; m++) {
      const th = m / 72 * TAU, c = Math.cos(th), sn = Math.sin(th), px = x + c * rx, py = cy + sn * ry;
      Pa(px + c, py + sn, IRON[0], a); Pa(px, py, sn < 0 ? IRON[3] : IRON[1], a); Pa(px - c, py - sn, IRON[2], a);
    }
    for (let m = 0; m < 14; m++) {
      const th = m / 14 * TAU + (close > 0.5 ? 0.22 : 0), c = Math.cos(th), sn = Math.sin(th), bx = x + c * (rx - 1.5), by = cy + sn * (ry - 1.5), L = 2.6 * k;
      line(bx, by, bx - c * L, by - sn * L * (ry / rx), IRON[4], a); Pa(bx - c * L, by - sn * L * (ry / rx), "#ffffff", a);
    }
    for (const s of [-1, 1]) { Rt(x + s * (rx + 1) - 1, cy - 1, 3, 3, IRON[1]); P(x + s * (rx + 1) - 1, cy - 1, IRON[3]); }
  }
  extend("smash", "jaws", {
    time: (X) => ({ windup: 0.2, impacts: X.tos.map((q, i) => 0.5 + i * 0.05), dur: 1.2 + X.tos.length * 0.05 }),
    draw(X, u, layer) {
      const k = X.k, end = X.T.dur, fade = 1 - seg(u, end - 0.3, end);
      X.tos.forEach((q, i) => {
        const ti = X.T.impacts[i], tt = u - ti, land = ti - 0.14;
        if (u < land) {
          if (u > X.T.windup) { const v = seg(u, X.T.windup, land), [x, y] = lob(X.src.x, X.src.y, q.x, q.y - 2, 22 * k, v); for (let m = -2; m <= 2; m++) Pa(x + m, y, IRON[m === -2 ? 3 : 2], 1); Pa(x, y - 1, IRON[4], 1); Pa(x - 2, y + 1, IRON[1], 1); Pa(x + 2, y + 1, IRON[1], 1); }
          return;
        }
        const close = tt < 0 ? 0 : eOut(Math.min(1, tt / 0.06));
        if (layer === "floor") { if (tt < 0) jaws(q.x, q.y + 1, 0, 1, k); gdisc(q.x, q.y + 1, 9 * k, IRON[0], 0.3 * fade); return; }
        if (tt >= 0) jaws(q.x, q.y + 1, close, fade, k);
        if (tt >= 0 && !X.P.miss) burst(X, q.x, q.y - 6 * k, tt, tdir(X, i), 0.9, "spark");
      });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { recoil(X, u, o, 2); return; }
      const tt = u - X.T.impacts[i];
      if (tt < 0) return;
      struck(X, u, i, o, 2);
      if (tt < 0.12) { o.dy = -2.5 * Math.sin(tt / 0.12 * Math.PI); o.sy = 1.04; }
      else if (u < X.T.dur - 0.3) o.dx = (o.dx || 0) + Math.sin(u * 40) * 0.5;
    },
    marks(X) { return X.P.miss ? [] : X.tos.map((q, i) => ({ kind: "gouge", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.5, seed: X.seed + i } })); },
  });

  // a log comes down on the foes from a cut rope above
  extend("smash", "deadfall", {
    time: (X) => ({ windup: 0.3, impacts: X.tos.map(() => 0.66), dur: 1.4 }),
    draw(X, u, layer) {
      const k = X.k, imp = X.T.impacts[0], xs = X.tos.map((q) => q.x), L = Math.max(...xs) - Math.min(...xs) + 26 * k, cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const gy = X.tos.reduce((m, q) => m + q.y, 0) / X.tos.length, top = Math.min(...X.tos.map((q) => q.y - hgt(q))) - 6;
      const fall = eIn(seg(u, imp - 0.25, imp)), tt = u - imp, bounce = tt > 0 ? Math.abs(Math.sin(Math.min(1, tt / 0.3) * Math.PI)) * 5 * (1 - seg(tt, 0, 0.3)) : 0;
      const ly = lerp(-12, tt > 0 ? gy - 5 * k - bounce : top + 4, tt > 0 ? 1 : fall), fade = 1 - seg(u, X.T.dur - 0.3, X.T.dur);
      if (layer === "floor") {
        if (u < imp) gdisc(cx, gy, (L / 2) * (0.4 + 0.6 * fall), "rgba(20,14,10,0.5)", 0.6 * fall);
        if (tt > 0 && tt < 0.5) for (let j = 0; j < 10; j++) part("dust", cx + hr(X.seed, j, 1, -0.5, 0.5) * L, gy - 1, 1.6 * k, 0, tt / 0.5, X.S, j);
        return;
      }
      if (u < imp - 0.25) {
        // the rope creaks, then snaps
        const sx = cx + L * 0.3, a = seg(u, X.T.windup - 0.1, X.T.windup + 0.1);
        line(sx, -2, sx, 14, ROPE[2], a); if (u > imp - 0.32) { Pa(sx, 14, ROPE[4], 1); star(sx, 15, 3, ROPE, 1); }
        return;
      }
      const R = 3.5 * k;
      for (let x = cx - L / 2; x <= cx + L / 2; x++) for (let dy = -R; dy <= R; dy++) {
        const v = dy / R, col = v < -0.55 ? LOG[3] : v < 0.1 ? LOG[2] : v < 0.7 ? LOG[1] : LOG[0];
        Pa(x, ly + dy, (fl(x) * 3 + fl(dy)) % 11 === 0 ? LOG[1] : col, fade);
      }
      for (const ex of [cx - L / 2, cx + L / 2]) { for (let dy = -R; dy <= R; dy++) Pa(ex, ly + dy, LOG[4], fade); Pa(ex, ly, LOG[1], fade); }
      if (tt > 0) X.tos.forEach((q, i) => { if (!X.P.miss) burst(X, q.x, gy - 8 * k, tt, tdir(X, i), 1.1, "spark"); });
    },
    pose(X, role, u, i, o) {
      if (role === "actor") { if (u > X.T.windup - 0.1 && u < X.T.windup + 0.2) o.dx = -X.dir * 1.5; return; }
      struck(X, u, i, o, 3);
      const tt = u - X.T.impacts[i];
      if (tt > 0 && tt < 0.2) { o.sy = 0.88 + 0.12 * (tt / 0.2); o.sx = 1.08 - 0.08 * (tt / 0.2); }
    },
    marks(X) { return X.P.miss ? [] : X.tos.map((q, i) => ({ kind: "crack", x: q.x, y: q.y + 1, at: X.T.impacts[i], opts: { size: 0.8, seed: X.seed + i } })); },
  });

  for (const f in EXT) {
    const F = FAM[f], base = { time: F.time, draw: F.draw, pose: F.pose, marks: F.marks };
    F.time = function (X) { const e = EXT[f][X.shape]; return e ? e.time.call(e, X) : base.time.call(this, X); };
    F.draw = function (X, u, layer) { const e = EXT[f][X.shape]; return e ? e.draw.call(e, X, u, layer) : base.draw.call(this, X, u, layer); };
    F.pose = function (X, role, u, i, o) { const e = EXT[f][X.shape]; return e ? e.pose.call(e, X, role, u, i, o) : base.pose.call(this, X, role, u, i, o); };
    F.marks = function (X) { const e = EXT[f][X.shape]; return e ? e.marks.call(e, X) : base.marks ? base.marks.call(this, X) : []; };
  }
  for (const f in FAM) FAM[f].id = f;

  // ---------- the 3x5 pixel font ----------
  const GLY = {};
  Object.entries({ A: "010,101,111,101,101", B: "110,101,110,101,110", C: "011,100,100,100,011", D: "110,101,101,101,110", E: "111,100,110,100,111", F: "111,100,110,100,100",
      G: "011,100,101,101,011", H: "101,101,111,101,101", I: "111,010,010,010,111", J: "001,001,001,101,010", K: "101,101,110,101,101", L: "100,100,100,100,111",
      M: "101,111,111,101,101", N: "110,101,101,101,101", O: "010,101,101,101,010", P: "110,101,110,100,100", Q: "010,101,101,110,011", R: "110,101,110,101,101",
      S: "011,100,010,001,110", T: "111,010,010,010,010", U: "101,101,101,101,111", V: "101,101,101,101,010", W: "101,101,111,111,101", X: "101,101,010,101,101",
      Y: "101,101,010,010,010", Z: "111,001,010,100,111", 0: "111,101,101,101,111", 1: "010,110,010,010,111", 2: "110,001,010,100,111", 3: "110,001,010,001,110",
      4: "101,101,111,001,001", 5: "111,100,110,001,110", 6: "011,100,111,101,111", 7: "111,001,010,010,010", 8: "111,101,111,101,111", 9: "111,101,111,001,110",
      "!": "010,010,010,000,010", "+": "000,010,111,010,000", "-": "000,000,111,000,000", " ": "000,000,000,000,000", ".": "000,000,000,000,010",
      ":": "000,010,000,010,000", "/": "001,001,010,100,100", "'": "010,010,000,000,000", "%": "101,001,010,100,101", ",": "000,000,000,010,100", "?": "111,001,010,000,010",
      "x": "000,101,010,101,000", "(": "010,100,100,100,010", ")": "010,001,001,001,010" }).forEach(([c, s]) => { GLY[c] = bm(s); });
  const INK = "#120c18";
  const tw = (s, sc) => s.length * 4 * sc - sc;
  // outline: one colour, or [inner, outer] for a double rim
  function text(str, x, y, col, sc, ol, align, a) {
    sc = sc || 1; str = String(str);
    const s = str.replace(/[a-wyz]/g, (m) => m.toUpperCase());
    x = fl(align === "l" ? x : align === "r" ? x - tw(s, sc) : x - tw(s, sc) / 2); y = fl(y);
    if (a === undefined) a = 1;
    const rims = ol === null ? [] : Array.isArray(ol) ? ol : [ol || INK];
    for (let pass = rims.length; pass >= 0; pass--) {
      const c = pass === 0 ? col : rims[pass - 1], o = pass;
      fs(c);
      for (let i = 0; i < s.length; i++) {
        const g = GLY[s[i]] || GLY[" "];
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
          if (!g[r][q]) continue;
          const px = x + (i * 4 + q) * sc, py = y + r * sc;
          if (a < 1 && !on(px, py, a)) continue;
          C.fillRect(px - o, py - o, sc + o * 2, sc + o * 2);
        }
      }
    }
  }

  // ---------- numbers, stamps ----------
  const NUM = {
    normal: { col: "#f6ebd0", ol: INK, sc: 2, life: 1.1, rise: 12 },
    crit: { col: "#ffd84a", ol: ["#c0281c", INK], sc: 3, life: 1.4, rise: 14, shake: 1 },
    heal: { col: "#8ef08a", ol: "#123a1a", sc: 2, life: 1.2, rise: 16, pre: "+" },
    miss: { col: "#c8bca8", ol: INK, sc: 1, life: 0.9, rise: 6, drift: 10, txt: "MISS" },
    tick: { col: "#e8dcc0", ol: INK, sc: 1, life: 0.9, rise: 10 },
    burn: { col: "#ff9a3a", ol: "#3a0c04", sc: 1, life: 0.9, rise: 12 },
    poison: { col: "#b4ec48", ol: "#1a2808", sc: 1, life: 0.9, rise: 8 },
    block: { col: "#b8cce8", ol: INK, sc: 1, life: 0.9, rise: 6, txt: "BLOCK" },
  };
  function number(style, txt, x, y, t) {
    const N = NUM[style] || NUM.normal;
    if (t < 0 || t > N.life) return false;
    let s = N.txt && (txt === undefined || txt === null || txt === "") ? N.txt : String(txt);
    if (N.pre && s[0] !== "+" && s[0] !== "-") s = N.pre + s;
    const pop = t < 0.05 ? 1 : 0, sc = N.sc + pop, rise = N.rise * eOut(Math.min(1, t / 0.45)) + (t > 0.7 * N.life ? (t - 0.7 * N.life) * 8 : 0);
    const jx = N.shake && t < 0.25 ? rnd(Math.sin(t * 90) * 1.5) : 0, dx = N.drift ? N.drift * eOut(Math.min(1, t / 0.5)) * (hs(txt, 1, 1) < 0.5 ? -1 : 1) : 0;
    const a = 1 - seg(t, N.life * 0.7, N.life);
    text(s, x + jx + dx, y - rise - sc * 2.5, N.col, sc, N.ol, "c", a);
    return true;
  }
  const STAMP_COL = { FROZEN: "#9ad8ff", ROOTED: "#9ad85a", STUNNED: "#ffd84a", BURNING: "#ff9a3a", POISONED: "#b4ec48", BLINDED: "#c8c0b8",
    MARKED: "#ff6a5a", CHARMED: "#f8a0c0", WEAKENED: "#c0a8d8", SHATTER: "#cdeeff", ZAP: "#e4ecff", SILENCED: "#c8c0b8", FEARED: "#c0a8d8" };
  const stampCache = new Map();
  function stampCanvas(kind, label) {
    const key = kind + "|" + label;
    if (stampCache.has(key)) return stampCache.get(key);
    const doc = root.document, cv = doc.createElement("canvas"), sc = kind === "ko" ? 4 : kind === "crit" ? 3 : 2;
    const pad = kind === "status" ? 4 : kind === "ko" ? 7 : 4, w = tw(label, sc) + pad * 2 + 8, h = 5 * sc + pad * 2 + 8;
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), keep = [C, cur];
    use(g);
    if (kind === "ko") { Rt(2, 2, w - 4, h - 4, INK); Rt(4, 4, w - 8, h - 8, "#d8402c"); Rt(6, 6, w - 12, h - 12, "#2a1010"); text(label, w / 2, pad + 4, "#ff5a40", sc, ["#7a1408", INK], "c"); }
    else if (kind === "crit") text(label, w / 2, pad + 4, "#ffd84a", sc, ["#c0281c", INK], "c");
    else { const col = STAMP_COL[label] || "#f6ebd0"; Rt(2, 2, w - 4, h - 4, INK); Rt(3, 3, w - 6, h - 6, "#2a1e18"); Rt(3, 3, w - 6, 1, col); Rt(3, h - 4, w - 6, 1, col); text(label, w / 2, pad + 4, col, sc, INK, "c"); }
    C = keep[0]; cur = null;
    stampCache.set(key, cv);
    return cv;
  }
  const STAMP_LIFE = { crit: 1.0, ko: 1.6, status: 1.1 };
  function stamp(ctx, kind, x, y, t, label) {
    kind = STAMP_LIFE[kind] ? kind : "status";
    const life = STAMP_LIFE[kind];
    if (t < 0 || t > life || !root.document) return false;
    label = String(label || (kind === "ko" ? "KO" : kind === "crit" ? "CRIT" : "!")).toUpperCase();
    const cv = stampCanvas(kind, label), slam = kind === "status" ? 0.06 : 0.09;
    const s = t < slam ? lerp(kind === "ko" ? 1.7 : kind === "crit" ? 1.6 : 1.35, 1, eIn(t / slam)) : t < slam + 0.08 ? 1 - 0.06 * Math.sin((t - slam) / 0.08 * Math.PI) : 1;
    const rot = kind === "ko" ? -0.14 : kind === "crit" ? -0.08 : 0, a = 1 - seg(t, life * 0.72, life);
    const jx = kind === "ko" && t < 0.3 ? rnd(Math.sin(t * 80) * 2 * (1 - t / 0.3)) : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = a;
    ctx.translate(rnd(x + jx), rnd(y - (kind === "status" ? 8 * eOut(Math.min(1, t / 0.3)) : 0)));
    ctx.rotate(rot);
    ctx.drawImage(cv, -cv.width * s / 2, -cv.height * s / 2, cv.width * s, cv.height * s);
    ctx.restore();
    return true;
  }

  // ---------- impact kit ----------
  const reduced = () => (root.Settings ? root.Settings.reduced() : !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
  function shake(t, power, seed) {
    power = power || 1;
    const dur = 0.16 + 0.11 * power;
    if (t < 0 || t > dur) return [0, 0];
    const amp = 1.4 * power * (reduced() ? 0.25 : 1), d = Math.pow(1 - t / dur, 2), s = (seed || 0) * 1.7;
    return [rnd(Math.sin(t * 95 + s) * amp * d), rnd(Math.cos(t * 71 + s * 1.3) * amp * 0.7 * d)];
  }
  function flash(ctx, w, h, t, strength) {
    if (t < 0 || t >= 2 / 60) return false;
    ctx.save();
    ctx.globalAlpha = (t < 1 / 60 ? 0.8 : 0.35) * (strength === undefined ? 1 : strength) * (reduced() ? 0.3 : 1);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return true;
  }
  const silCache = new WeakMap();
  function silhouette(img, col) {
    if (!img || !root.document) return img;
    let m = silCache.get(img);
    if (!m) { m = new Map(); silCache.set(img, m); }
    col = col || "#ffffff";
    if (m.has(col)) return m.get(col);
    const cv = root.document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext("2d");
    g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
    m.set(col, cv);
    return cv;
  }

  // ---------- status overlays ----------
  function status(st, q, t) {
    const h = hgt(q), c = chest(q), hd = head(q), k = SCALE;
    switch (st) {
      case "burn": { const S = SCHOOLS.flame; for (let j = 0; j < 4; j++) { const ph = (t * 1.7 + j / 4) % 1, x = q.x + hr(7, j + fl(t * 1.7 + j / 4) * 4, 1, -6, 6) * k, y = q.y - h * hr(7, j, 2, 0.15, 0.75) - ph * 8; part("tongue", x, y, 0.55, -Math.PI / 2, ph, S, j); } break; }
      case "chill": { const S = SCHOOLS.frost; for (let j = -2; j <= 2; j++) shard(q.x + j * 3 * k, q.y + 1, (3 + (j % 2 ? 1 : 2)) * k, -Math.PI / 2 + j * 0.25, S.pal, 0.85); for (let j = 0; j < 3; j++) { const ph = (t * 0.6 + j / 3) % 1; part("flake", q.x + Math.sin(t * 2 + j * 2) * 7, q.y - h + ph * h, 0.8, 0, ph, S, j); } break; }
      case "stun": for (let j = 0; j < 3; j++) { const a = t * 5 + j * TAU / 3, x = hd.x + Math.cos(a) * 7 * k, y = hd.y - 3 + Math.sin(a) * 2; bmp(BMP.star, x - 2, y - 2, Math.sin(a) > 0 ? "#ffd84a" : "#c8961c"); } break;
      case "weaken": { const pal = ["#2a2034", "#5a4a70", "#9a88b8", "#d0c4e8", "#ffffff"]; for (let j = 0; j < 2; j++) { const ph = (t * 0.8 + j / 2) % 1, x = q.x + (j ? 7 : -7) * k, y = hd.y + 2 + ph * 12, a = 1 - ph; chevron(x, y + 3, 3, pal[0], pal[0], a); line(x - 3, y, x, y + 3, pal[2], a); line(x, y + 3, x + 3, y, pal[2], a); line(x - 3, y - 1, x, y + 2, pal[3], a); line(x, y + 2, x + 3, y - 1, pal[3], a); } break; }
      case "blind": {
        const ey = hd.y + fl(h * 0.24);
        for (let x = -6; x <= 6; x++) { Pa(hd.x + x, ey - 1, "#3a3048", 0.9); Pa(hd.x + x, ey, "#120c18", 1); Pa(hd.x + x, ey + 1, "#3a3048", 0.9); }
        const qy = hd.y - 12 - Math.sin(t * 4) * 1.5; bmp(BMP.q, hd.x - 2, qy + 1, "#120c18", 1, null, 2); bmp(BMP.q, hd.x - 3, qy, "#f6ebd0", 1, null, 2); break;
      }
      case "poison": { const S = SCHOOLS.poison; for (let j = 0; j < 4; j++) { const ph = (t * 1.1 + j / 4) % 1; drip(q.x + (j - 1.5) * 4 * k, c.y - 4 + ph * h * 0.6, 3, S.pal, 1 - ph); } for (let j = 0; j < 2; j++) { const ph = (t * 0.9 + j / 2) % 1; bubble(q.x + (j ? 5 : -4), hd.y - ph * 10, S.pal, 1 - ph, ph > 0.85); } halo(c.x, c.y, 8, S.pal, 0.18); break; }
      case "marked": { const red = ["#4a0c0c", "#a01c1c", "#e8402c", "#ff9a7a"], y = hd.y - 7 - Math.sin(t * 6), s = 4; poly([[q.x, y - s - 1], [q.x + s + 1, y], [q.x, y + s + 1], [q.x - s - 1, y]], red[0], 1); poly([[q.x, y - s], [q.x + s, y], [q.x, y + s], [q.x - s, y]], red[2], 1); poly([[q.x, y - s + 1.5], [q.x + s - 1.5, y], [q.x, y + s - 1.5], [q.x - s + 1.5, y]], red[3], 1); break; }
      case "charm": { const S = SCHOOLS.song; for (let j = 0; j < 2; j++) { const ph = (t * 0.7 + j / 2) % 1, x = hd.x + (j ? 6 : -5) + Math.sin(t * 3 + j) * 2, y = hd.y - 2 - ph * 14; bmp(BMP.heart, x - 3, y - 2, "#4a1830", 1 - ph); bmp(BMP.heart, x - 2, y - 3, "#f06a98", 1 - ph); Pa(x - 1, y - 2, "#ffffff", 1 - ph); } break; }
      case "bleed": { const pal = SCHOOLS.fury.pal, ph = (t * 1.5) % 1, a = 1 - ph * 0.6; for (let j = 0; j < 3; j++) { const x = q.x + (j - 1) * 4, y = c.y + (j - 1) * 3; line(x - 3, y + 3, x + 3, y - 3, pal[0], a); line(x - 2, y + 3, x + 3, y - 2, ph < 0.4 ? pal[3] : pal[2], a); } break; }
      case "guard": { const pal = SCHOOLS.shield.pal, d = q.dir || 1, x = c.x + d * 10, a = 0.75 + 0.25 * Math.sin(t * 3); line(x + d, c.y - 9, x + d, c.y + 8, pal[0], a); line(x, c.y - 9, x, c.y + 8, pal[3], a); line(x - d, c.y - 8, x - d, c.y + 7, pal[2], a); const gy = c.y - 9 + ((t * 0.8) % 1) * 17; P(x, gy, pal[4]); P(x - d, gy + 1, pal[4]); break; }
      case "stealth": { const S = SCHOOLS.shadow; for (let j = 0; j < 3; j++) { const ph = (t * 0.9 + j / 3) % 1; part("wisp", q.x + (j - 1) * 6, q.y - ph * h, 1, -Math.PI / 2, ph, S, j, t); } break; }
      default: return false;
    }
    return true;
  }

  // ---------- floor decals ----------
  const DK = (a) => `rgba(46,32,22,${Math.min(1, a * 1.25)})`;
  const DECAL = {
    crack(x, y, o) {
      const sd = o.seed || 0;
      if (o.to) {
        const [x1, y1] = o.to, n = Math.max(2, fl(Math.abs(x1 - x) / 6));
        let px = x, py = y;
        for (let j = 1; j <= n; j++) { const v = j / n, nx = lerp(x, x1, v) + hr(sd, j, 1, -1, 1), ny = lerp(y, y1, v) + hr(sd, j, 2, -1.5, 1.5); line(px, py, nx, ny, DK(0.85)); line(px, py + 1, nx, ny + 1, "rgba(240,228,200,0.35)"); if (j % 3 === 0) line(nx, ny, nx + hr(sd, j, 3, -5, 5), ny + hr(sd, j, 4, -2, 2), DK(0.7)); px = nx; py = ny; }
        return;
      }
      const L = 15 * (o.size || 1) * SCALE;
      gdisc(x, y, 5 * (o.size || 1) * SCALE, DK(0.4), 0.6);
      for (let k2 = 0; k2 < 7; k2++) {
        let a = k2 * TAU / 7 + hs(sd, k2, 1) * 0.5, px = x, py = y;
        for (let m = 0; m < 3; m++) { a += hr(sd, k2 * 3 + m, 2, -0.6, 0.6); const nx = px + Math.cos(a) * L / 3, ny = py + Math.sin(a) * L / 3 * FLAT; line(px, py, nx, ny, DK(0.9)); if (m) line(px, py + 1, nx, ny + 1, "rgba(240,228,200,0.4)"); px = nx; py = ny; }
      }
    },
    scorch(x, y, o) {
      const r = 11 * (o.size || 1) * SCALE, sd = o.seed || 0, cold = o.school === "storm";
      for (let j = 0; j < 9; j++) { const a = hs(sd, j, 1) * TAU, rr = hs(sd, j, 2) * r * 0.7; gdisc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * FLAT, r * hr(sd, j, 3, 0.3, 0.55), cold ? "rgba(30,30,50,0.9)" : "rgba(40,24,14,0.9)", 0.45); }
      gdisc(x, y, r * 0.55, cold ? "rgba(24,24,40,0.95)" : "rgba(30,18,10,0.95)", 0.75);
      for (let j = 0; j < 7; j++) { const a = hs(sd, j, 4) * TAU, rr = hs(sd, j, 5) * r; P(x + Math.cos(a) * rr, y + Math.sin(a) * rr * FLAT, j % 2 ? "rgba(90,70,56,0.8)" : "rgba(20,14,10,0.8)"); }
    },
    frost(x, y, o) {
      const r = 12 * (o.size || 1) * SCALE, sd = o.seed || 0;
      gdisc(x, y, r, "rgba(214,238,255,0.9)", 0.35); gdisc(x, y, r * 0.55, "rgba(236,248,255,0.9)", 0.5);
      for (let j = 0; j < 9; j++) { const a = hs(sd, j, 1) * TAU, L = hr(sd, j, 2, 0.5, 1) * r; line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * FLAT, "rgba(160,210,245,0.85)"); P(x + Math.cos(a) * L, y + Math.sin(a) * L * FLAT, "#ffffff"); }
    },
    vines(x, y, o) {
      const r = 12 * (o.size || 1) * SCALE, sd = o.seed || 0, pal = SCHOOLS.wild.pal;
      for (let j = 0; j < 4; j++) {
        let a = hs(sd, j, 1) * TAU, px = x, py = y;
        for (let m = 0; m < r; m++) { a += Math.sin(m * 0.4 + j) * 0.12; px += Math.cos(a); py += Math.sin(a) * FLAT; P(px, py, m % 4 ? "rgba(44,82,26,0.9)" : "rgba(30,56,18,0.9)"); if (m % 5 === 3) { P(px, py - 1, pal[2]); P(px + 1, py - 1, pal[1]); } }
      }
    },
    stub(x, y, o) {
      const s = o.flip ? -1 : 1;
      line(x, y, x - 5 * s, y - 6, "#5c3e22"); line(x + 1 * s, y, x - 4 * s, y - 6, "#7a5230");
      P(x - 5 * s, y - 6, "#f4ecdc"); P(x - 6 * s, y - 6, "#c84a3a"); P(x - 5 * s, y - 7, "#e8dcc4"); P(x - 6 * s, y - 7, "#f4ecdc");
      P(x, y + 1, DK(0.5)); P(x + s, y + 1, DK(0.3));
    },
    skid(x, y, o) {
      const L = 16 * (o.size || 1) * SCALE, s = o.flip ? -1 : 1;
      for (const dy of [-1.5, 1.5]) { line(x - s * L, y + dy, x, y + dy, DK(0.55)); line(x - s * L * 0.6, y + dy + 0.6, x - s * 2, y + dy + 0.6, DK(0.3)); }
      for (let j = 0; j < 4; j++) P(x + s * j, y + (j % 2 ? 2 : -2), "rgba(200,180,140,0.6)");
    },
    scuff(x, y, o) {
      const r = 16 * (o.size || 1) * SCALE, sd = o.seed || 0;
      for (let a = 0; a < 360; a += 14) {
        if (hs(sd, a, 1) < 0.25) continue;
        const a0 = (a + hr(sd, a, 2, 0, 4)) * Math.PI / 180, rr = r + hr(sd, a, 3, -2, 2);
        for (let m = 0; m < 4; m++) { const th = a0 + m * 0.035; P(x + Math.cos(th) * rr, y + Math.sin(th) * rr * FLAT, DK(0.55)); P(x + Math.cos(th) * (rr - 1), y + Math.sin(th) * (rr - 1) * FLAT + 1, "rgba(238,226,196,0.4)"); }
      }
    },
    puddle(x, y, o) {
      const S = SCHOOLS[o.school] || SCHOOLS.poison, r = 9 * (o.size || 1) * SCALE, sd = o.seed || 0;
      for (let j = 0; j < 4; j++) { const a = hs(sd, j, 1) * TAU, rr = hs(sd, j, 2) * r * 0.5; gdisc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * FLAT, r * hr(sd, j, 3, 0.4, 0.7), S.pal[1], 0.85); }
      gdisc(x, y, r * 0.4, S.pal[2], 0.7); P(x - r * 0.2, y - 1, S.pal[3]); P(x - r * 0.2 + 1, y - 1, S.pal[4]);
    },
    rune(x, y, o) {
      const S = SCHOOLS[o.school] || SCHOOLS.arcane, r = 12 * (o.size || 1) * SCALE;
      gring(x, y, r, S.pal[1], 0.8, 1, 0); gring(x, y, r * 0.7, S.pal[1], 0.6, 1, 8);
      for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; bmp(MINIRUNE[mod(j + (o.seed || 0), MINIRUNE.length)], x + Math.cos(a) * r * 0.85 - 1, y + Math.sin(a) * r * 0.85 * FLAT - 1, S.pal[1], 0.8); }
    },
    holy(x, y, o) {
      const pal = SCHOOLS.holy.pal, r = 12 * (o.size || 1) * SCALE;
      gdisc(x, y, r, "rgba(255,236,170,0.9)", 0.25); gring(x, y, r, pal[1], 0.7, 1, 0);
      for (let j = 0; j < 8; j++) { const a = j / 8 * TAU; line(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3 * FLAT, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9 * FLAT, j % 2 ? "rgba(200,144,32,0.5)" : "rgba(244,208,80,0.7)"); }
    },
    ash(x, y, o) {
      const r = 10 * (o.size || 1) * SCALE, sd = o.seed || 0;
      gdisc(x, y, r, "rgba(60,64,52,0.95)", 0.5); gdisc(x, y, r * 0.55, "rgba(40,44,34,0.95)", 0.7);
      for (let j = 0; j < 6; j++) { const a = hs(sd, j, 1) * TAU, rr = hs(sd, j, 2) * r; P(x + Math.cos(a) * rr, y + Math.sin(a) * rr * FLAT, j % 2 ? "#c8c4b0" : "rgba(140,170,110,0.8)"); }
    },
    gouge(x, y, o) {
      const L = 10 * (o.size || 1) * SCALE, s = o.flip ? -1 : 1;
      for (let j = 0; j < 3; j++) { const ox = (j - 1) * 3; line(x + ox - s * L / 2, y - 1 + j, x + ox + s * L / 2, y + 1 + j, DK(0.9)); line(x + ox - s * L / 2 + 1, y - 1 + j, x + ox + s * L / 2 - 1, y + 1 + j, DK(0.6)); line(x + ox - s * L / 2, y + j, x + ox + s * L / 2, y + 2 + j, "rgba(240,228,200,0.45)"); }
    },
    cut(x, y, o) {
      const L = 9 * (o.size || 1) * SCALE, sd = o.seed || 0, a = hr(sd, 1, 1, -0.4, 0.4);
      line(x - Math.cos(a) * L, y - Math.sin(a) * L * FLAT, x + Math.cos(a) * L, y + Math.sin(a) * L * FLAT, DK(0.9));
      line(x - Math.cos(a) * L * 0.8, y - Math.sin(a) * L * FLAT * 0.8 - 1, x + Math.cos(a) * L * 0.8, y + Math.sin(a) * L * FLAT * 0.8 - 1, DK(0.5));
      line(x - Math.cos(a) * L * 0.6, y - Math.sin(a) * L * FLAT * 0.6 + 1, x + Math.cos(a) * L * 0.6, y + Math.sin(a) * L * FLAT * 0.6 + 1, "rgba(240,228,200,0.4)");
    },
    soot(x, y, o) {
      const r = 10 * (o.size || 1) * SCALE, shadow = o.school === "shadow" || o.school === "death";
      gdisc(x, y, r, shadow ? "rgba(34,20,48,0.95)" : "rgba(30,26,24,0.95)", 0.45); gdisc(x, y, r * 0.55, shadow ? "rgba(26,14,36,0.95)" : "rgba(24,20,18,0.95)", 0.65);
    },
    hoof(x, y, o) {
      const s = o.flip ? -1 : 1;
      for (let j = 0; j < 4; j++) { const hx = x - s * j * 6, hy = y + (j % 2 ? 2 : -1); Rt(hx - 1, hy, 4, 1, DK(0.7)); P(hx - 1, hy + 1, DK(0.7)); P(hx + 2, hy + 1, DK(0.7)); P(hx, hy - 1, "rgba(240,228,200,0.4)"); }
    },
  };
  const FRESH = { scorch: 1.6, frost: 1.2, rune: 1.4, holy: 1.4, puddle: 1.0, vines: 0.6 };
  function floor(w, h) {
    const doc = root.document, cv = doc.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), fresh = [];
    return {
      canvas: cv,
      add(kind, x, y, opts, t) {
        if (!DECAL[kind]) return;
        use(g); DECAL[kind](rnd(x), rnd(y), opts || {});
        if (FRESH[kind]) fresh.push({ kind, x: rnd(x), y: rnd(y), o: opts || {}, t: t || 0 });
      },
      draw(ctx, t) {
        ctx.drawImage(cv, 0, 0);
        use(ctx);
        for (let i = fresh.length - 1; i >= 0; i--) {
          const f = fresh[i], age = t - f.t, life = FRESH[f.kind];
          if (age > life) { fresh.splice(i, 1); continue; }
          if (age < 0) continue;
          const a = 1 - age / life, r = (f.o.size || 1) * SCALE, sd = f.o.seed || 0;
          if (f.kind === "scorch") for (let j = 0; j < 10; j++) { const an = hs(sd, j, 6) * TAU, rr = hs(sd, j, 7) * 10 * r, fl2 = (Math.sin(t * 13 + j * 2) + 1) / 2; Pa(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * FLAT, fl2 > 0.5 ? "#ffb040" : "#e05a18", a * (0.5 + fl2 * 0.5)); }
          else if (f.kind === "frost") { const gx = f.x + Math.sin(t * 3 + sd) * 6 * r; star(gx, f.y, 2, SCHOOLS.frost.pal, a); }
          else if (f.kind === "puddle") { const ph = (t * 1.3 + sd) % 1; bubble(f.x + 2, f.y - 1 - ph * 2, (SCHOOLS[f.o.school] || SCHOOLS.poison).pal, a, ph > 0.8); }
          else if (f.kind === "vines") glowAt(f.x, f.y, 8 * r, SCHOOLS.wild.pal, a * 0.5);
          else { const S = f.kind === "holy" ? SCHOOLS.holy : SCHOOLS[f.o.school] || SCHOOLS.arcane; gring(f.x, f.y, 12 * r, S.pal[3], a, 1, 0); glowAt(f.x, f.y, 10 * r, S.pal, a * 0.6); }
        }
      },
      clear() { g.clearRect(0, 0, w, h); fresh.length = 0; },
    };
  }

  // ---------- area ring ----------
  function ringDraw(x, y, r, t, P, mode) {
    const S = school(P), pal = S.pal;
    if (mode === "tell") {
      const a = Math.min(1, Math.max(0, t) * 4) * 0.85, pr = r * (1 + 0.04 * Math.sin(t * 18));
      gdisc(x, y, pr, pal[2], 0.12 * a);
      gring(x, y, pr, pal[3], a, 1, 0);
      gring(x, y, pr - 2, pal[2], a * 0.6, 1, 12, t * 1.5, t * 1.5 + TAU);
      for (let j = 0; j < 4; j++) { const th = j * Math.PI / 2 + Math.PI / 4; line(x + Math.cos(th) * pr, y + Math.sin(th) * pr * FLAT, x + Math.cos(th) * (pr - 4), y + Math.sin(th) * (pr - 4) * FLAT, pal[4], a); }
      return t < 2;
    }
    if (t < 0 || t > 0.7) return false;
    const q = eOut(Math.min(1, t / 0.32)), rr = r * (0.3 + 0.85 * q), a = 1 - seg(t, 0.15, 0.7);
    gring(x, y, rr, t < 0.06 ? pal[4] : pal[3], a, 2, 0);
    gring(x, y, rr * 0.8, pal[2], a * 0.6, 1, 0);
    gring(x, y, r, pal[2], 0.5 * (1 - seg(t, 0.2, 0.7)), 1, 16);
    return true;
  }

  // ---------- sound: its own WebAudio context, following Settings and first-click unlock ----------
  const Snd = (() => {
    let ac = null, out = null, nb = null, unlocked = false;
    // the site keeps sound in Settings; review pages that load this file alone fall back to the old "al.sound" store
    const prefs = () => {
      const S = root.Settings;
      if (S) return { on: S.get("sound"), master: S.get("master"), sfx: S.get("sfx") };
      try { return Object.assign({ on: true, master: 0.7, sfx: 0.6 }, JSON.parse(root.localStorage.getItem("al.sound") || "{}")); } catch (e) { return { on: true, master: 0.7, sfx: 0.6 }; }
    };
    // a player fetched on first use loads after the click that opened its page, so the page's own unlock counts too
    const open = () => unlocked || !!(root.Sound && root.Sound.unlocked);
    function noiseBuf(c) { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
    function init() {
      if (ac) return ac;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
      out = ac.createGain(); out.connect(comp); comp.connect(ac.destination);
      nb = noiseBuf(ac);
      return ac;
    }
    function ok() {
      const pr = prefs();
      if (!open() || !pr.on || !init()) return null;
      if (ac.state === "suspended") ac.resume();
      out.gain.value = pr.master * pr.sfx * 0.9;
      return ac;
    }
    function noise(t, dur, vol, type, freq, q, f2, att) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = nb; s.loop = true;
      f.type = type || "lowpass"; f.frequency.setValueAtTime(freq || 800, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || Math.min(0.004, dur / 4))); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
      return g;
    }
    function tone(t, f0, f1, dur, vol, type, att, lp) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || 0.003)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      if (lp) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
      g.connect(out); o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    // amplitude-wobbled tone: growls, buzzes, drones
    function wob(t, f0, f1, dur, vol, type, rate, depth, lp) {
      const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter();
      o.type = type || "sawtooth"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      l.frequency.value = rate; lg.gain.value = vol * depth; l.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur / 3)); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      f.type = "lowpass"; f.frequency.value = lp || 900;
      o.connect(f); f.connect(g); g.connect(out); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
    }
    function ring(t, f, dur, vol) { for (const [m, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]]) tone(t, f * m, f * m * 0.997, dur / Math.sqrt(m), vol * a); }
    function bell(t, f, dur, vol) { for (const [m, a] of [[0.5, 0.4], [1, 1], [2, 0.5], [2.4, 0.35], [3, 0.2]]) tone(t, f * m, f * m, dur / Math.sqrt(m + 0.5), vol * a, "sine", 0.002); }
    const R = Math.random;
    // the building blocks every school and family share
    const B = {
      whoosh: (t, p, v, len) => noise(t, len || 0.16, 0.32 * v, "bandpass", 600 * p, 1.4, 3200 * p, (len || 0.16) * 0.55),
      thud: (t, p, v) => { tone(t, 150 * p, 48, 0.2, 0.55 * v); noise(t, 0.12, 0.42 * v, "lowpass", 1400, 1, 300); noise(t, 0.04, 0.22 * v, "bandpass", 2600 * p, 2); },
      heavy: (t, p, v) => { tone(t, 95 * p, 32, 0.42, 0.7 * v); noise(t, 0.34, 0.5 * v, "lowpass", 900, 1, 140); for (let i = 0; i < 4; i++) noise(t + 0.04 + i * 0.035, 0.03, 0.12 * v, "bandpass", 1500 + R() * 2000, 3); },
      crackle: (t, d, v) => { for (let i = 0; i < 9; i++) noise(t + R() * d, 0.012 + R() * 0.018, (0.1 + R() * 0.12) * v, "bandpass", 1400 + R() * 3500, 1.5); },
      clink: (t, f, v) => { ring(t, f, 0.5, 0.09 * v); noise(t, 0.02, 0.25 * v, "highpass", 4500); },
      pluck: (t, f, v, d) => { tone(t, f, f * 0.995, d || 0.35, 0.16 * v, "triangle", 0.002); tone(t, f * 2, f * 2, (d || 0.35) * 0.4, 0.05 * v, "square", 0.002, 2400); },
    };
    const NOTES = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
    // per school timbre: the cast (charge, swing flavour) and the hit
    const TIM = {
      thud: { cast: (t, p, v) => B.whoosh(t, p, v * 0.8), hit: (t, p, v) => B.thud(t, p, v) },
      steel: { cast: (t, p, v) => { B.whoosh(t, p * 1.2, v); noise(t + 0.06, 0.1, 0.12 * v, "highpass", 6000 * p); ring(t + 0.05, 2500 * p, 0.3, 0.035 * v); }, hit: (t, p, v) => { B.thud(t, p, v * 0.9); ring(t, 1700 * p, 0.4, 0.07 * v); noise(t, 0.05, 0.25 * v, "highpass", 5000); } },
      clang: { cast: (t, p, v) => { ring(t, 900 * p, 0.35, 0.05 * v); noise(t, 0.2, 0.06 * v, "highpass", 5000); }, hit: (t, p, v) => { ring(t, 520 * p, 0.8, 0.14 * v); noise(t, 0.08, 0.4 * v, "bandpass", 3000, 1.5); tone(t, 140, 70, 0.15, 0.35 * v); } },
      roar: { cast: (t, p, v) => { noise(t, 0.4, 0.3 * v, "lowpass", 300 * p, 3, 900 * p, 0.12); wob(t, 95 * p, 70 * p, 0.42, 0.2 * v, "sawtooth", 28, 0.6, 700); }, hit: (t, p, v) => { B.heavy(t, p, v * 0.9); noise(t, 0.2, 0.2 * v, "lowpass", 600, 2); } },
      horn: { cast: (t, p, v) => { for (const [d, f] of [[0, 220], [0.16, 330]]) { tone(t + d, f * p, f * p, 0.32, 0.12 * v, "sawtooth", 0.03, 1100); tone(t + d, f * p * 1.005, f * p, 0.32, 0.08 * v, "square", 0.03, 900); } }, hit: (t, p, v) => B.thud(t, p, v) },
      fire: { cast: (t, p, v) => { noise(t, 0.38, 0.32 * v, "lowpass", 220 * p, 1, 1600 * p, 0.2); B.crackle(t + 0.05, 0.35, v); }, hit: (t, p, v) => { tone(t, 85 * p, 38, 0.4, 0.55 * v); noise(t, 0.45, 0.5 * v, "lowpass", 1200, 1, 180); B.crackle(t + 0.04, 0.5, v * 1.2); } },
      ice: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) tone(t + i * 0.045, (2300 + R() * 1400) * p, 0, 0.2, 0.08 * v); noise(t, 0.3, 0.1 * v, "highpass", 6500, 0, 0, 0.15); }, hit: (t, p, v) => { for (let i = 0; i < 11; i++) tone(t + R() * 0.08, (2000 + R() * 3500) * p, 0, 0.12 + R() * 0.1, 0.045 * v); noise(t, 0.16, 0.38 * v, "bandpass", 4200 * p, 1.2); tone(t, 320 * p, 150, 0.12, 0.25 * v, "triangle"); } },
      zap: { cast: (t, p, v) => { wob(t, 62 * p, 70 * p, 0.32, 0.16 * v, "sawtooth", 47, 0.8, 1400); B.crackle(t, 0.3, v * 0.6); }, hit: (t, p, v) => { noise(t, 0.09, 0.7 * v, "highpass", 1800); tone(t, 1300 * p, 180, 0.1, 0.12 * v, "square"); noise(t + 0.02, 0.6, 0.35 * v, "lowpass", 320, 1, 90); } },
      arcane: { cast: (t, p, v) => { [1, 1.25, 1.5, 2].forEach((m, i) => tone(t + i * 0.055, 660 * p * m, 0, 0.22, 0.13 * v, "sine", 0.004)); noise(t, 0.3, 0.07 * v, "highpass", 7000); }, hit: (t, p, v) => { bell(t, 880 * p, 0.7, 0.07 * v); tone(t, 1900 * p, 380, 0.16, 0.1 * v, "triangle"); tone(t, 110, 60, 0.15, 0.3 * v); } },
      lore: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) noise(t + i * 0.04 + R() * 0.02, 0.03, 0.12 * v, "bandpass", 2800 + R() * 1500, 2); tone(t + 0.1, 520 * p, 520 * p, 0.3, 0.06 * v, "triangle", 0.02); }, hit: (t, p, v) => { ring(t, 740 * p, 0.6, 0.07 * v); B.thud(t, p, v * 0.6); } },
      holy: { cast: (t, p, v) => { [392, 494, 587, 784].forEach((f, i) => { tone(t, f * p, f * p * 1.003, 0.55, 0.1 * v, "triangle", 0.25); tone(t, f * p * 1.006, f * p, 0.55, 0.06 * v, "sine", 0.25); }); }, hit: (t, p, v) => { bell(t, 1046 * p, 1.1, 0.07 * v); noise(t, 0.4, 0.08 * v, "highpass", 6000, 0, 0, 0.05); tone(t, 130, 70, 0.2, 0.3 * v); } },
      heal: { cast: (t, p, v) => { [523, 659, 784, 1046].forEach((f, i) => { tone(t + i * 0.07, f * p, 0, 0.4, 0.16 * v, "sine", 0.01); tone(t + i * 0.07, f * p * 2, 0, 0.2, 0.04 * v, "sine", 0.01); }); }, hit: (t, p, v) => { [523, 659, 784].forEach((f) => tone(t, f * p, f * p, 0.8, 0.12 * v, "triangle", 0.03)); bell(t + 0.02, 1568 * p, 0.6, 0.06 * v); noise(t, 0.35, 0.1 * v, "highpass", 7000, 0, 0, 0.05); } },
      shadow: { cast: (t, p, v) => { noise(t, 0.36, 0.3 * v, "bandpass", 380 * p, 1.2, 900 * p, 0.32); tone(t, 110 * p, 68 * p, 0.4, 0.12 * v, "sine", 0.2); }, hit: (t, p, v) => { tone(t, 72 * p, 36, 0.3, 0.55 * v); noise(t, 0.28, 0.16 * v, "highpass", 3200, 0, 0, 0.06); } },
      death: { cast: (t, p, v) => { wob(t, 55 * p, 52 * p, 0.5, 0.16 * v, "sawtooth", 6, 0.4, 420); noise(t, 0.45, 0.12 * v, "bandpass", 1700 * p, 5, 1300 * p, 0.2); }, hit: (t, p, v) => { tone(t, 230 * p, 180 * p, 0.14, 0.25 * v, "triangle"); tone(t, 110 * p, 70, 0.2, 0.35 * v); tone(t + 0.04, 440 * p, 440 * p, 0.6, 0.04 * v, "sine", 0.01); tone(t + 0.04, 523 * p, 523 * p, 0.6, 0.035 * v, "sine", 0.01); } },
      wild: { cast: (t, p, v) => { for (let i = 0; i < 8; i++) noise(t + R() * 0.3, 0.04, 0.09 * v, "bandpass", 2500 + R() * 2200, 2); wob(t + 0.05, 140 * p, 120 * p, 0.25, 0.06 * v, "sawtooth", 11, 0.7, 700); }, hit: (t, p, v) => { tone(t, 420 * p, 250 * p, 0.09, 0.3 * v, "triangle"); noise(t, 0.06, 0.3 * v, "bandpass", 950, 2); tone(t, 120, 60, 0.15, 0.35 * v); for (let i = 0; i < 5; i++) noise(t + 0.03 + R() * 0.2, 0.04, 0.06 * v, "bandpass", 3000 + R() * 2000, 2); } },
      beast: { cast: (t, p, v) => wob(t, 82 * p, 64 * p, 0.38, 0.28 * v, "sawtooth", 24, 0.7, 650), hit: (t, p, v) => { B.thud(t, p * 0.9, v); wob(t, 120 * p, 90 * p, 0.18, 0.15 * v, "sawtooth", 30, 0.6, 900); } },
      bow: { cast: (t, p, v) => { tone(t, 190 * p, 175 * p, 0.28, 0.2 * v, "triangle", 0.002); noise(t, 0.02, 0.25 * v, "bandpass", 2400, 2); tone(t + 0.04, 2300 * p, 1300 * p, 0.22, 0.03 * v); }, hit: (t, p, v) => { noise(t, 0.05, 0.4 * v, "bandpass", 1300 * p, 2.5); tone(t, 200 * p, 90, 0.1, 0.35 * v); } },
      hooves: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) { const at = t + i * 0.07 + (i % 2) * 0.02; noise(at, 0.03, 0.18 * v, "lowpass", 1100); tone(at, 210 * p, 130, 0.05, 0.14 * v); } }, hit: (t, p, v) => B.heavy(t, p, v * 0.8) },
      coin: { cast: (t, p, v) => { for (let i = 0; i < 3; i++) B.clink(t + i * 0.06, (2200 + R() * 300) * p, v * 0.7); }, hit: (t, p, v) => { B.thud(t, p, v * 0.5); for (let i = 0; i < 7; i++) B.clink(t + 0.02 + i * 0.045 + R() * 0.02, (1900 + R() * 600) * p, v * (1 - i * 0.1)); } },
      song: { cast: (t, p, v) => { [0, 2, 4, 7].forEach((n, i) => B.pluck(t + i * 0.07, 392 * p * NOTES[n % 8] * (n > 6 ? 1 : 1), v)); }, hit: (t, p, v) => { [0, 2, 4].forEach((n, i) => B.pluck(t + i * 0.015, 262 * p * NOTES[n], v, 0.6)); tone(t, 110, 60, 0.12, 0.25 * v); } },
      hearth: { cast: (t, p, v) => { noise(t, 0.3, 0.15 * v, "lowpass", 300 * p, 1, 900 * p, 0.12); B.crackle(t, 0.3, v * 0.6); }, hit: (t, p, v) => { tone(t, 120 * p, 60, 0.22, 0.4 * v); B.crackle(t, 0.25, v * 0.8); } },
      craft: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) { noise(t + i * 0.038, 0.02, 0.18 * v, "bandpass", 3200 * p, 4); tone(t + i * 0.038, 900 * p, 700 * p, 0.03, 0.06 * v, "square"); } }, hit: (t, p, v) => { ring(t, 310 * p, 0.6, 0.12 * v); ring(t, 467 * p, 0.4, 0.07 * v); B.thud(t, p, v * 0.8); } },
      poison: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) { const at = t + i * 0.055 + R() * 0.02, f = (300 + R() * 300) * p; tone(at, f, f * 2.4, 0.07, 0.09 * v); } }, hit: (t, p, v) => { noise(t, 0.28, 0.4 * v, "lowpass", 1000, 1, 180); tone(t, 180, 70, 0.18, 0.25 * v); for (let i = 0; i < 4; i++) { const f = (400 + R() * 400) * p; tone(t + 0.08 + i * 0.06, f, f * 2, 0.06, 0.06 * v); } } },
      water: { cast: (t, p, v) => noise(t, 0.35, 0.22 * v, "lowpass", 400 * p, 1, 1200 * p, 0.15), hit: (t, p, v) => { noise(t, 0.3, 0.4 * v, "bandpass", 1500 * p, 0.8, 500); for (let i = 0; i < 5; i++) { const f = (900 + R() * 900) * p; tone(t + 0.05 + R() * 0.2, f, f * 1.6, 0.05, 0.05 * v); } } },
      illusion: { cast: (t, p, v) => { [1568, 1319, 1175, 988].forEach((f, i) => { tone(t + i * 0.05, f * p, f * p * 1.01, 0.38, 0.07 * v, "sine", 0.01); tone(t + i * 0.05, f * p * 1.007, f * p, 0.38, 0.05 * v, "triangle", 0.01); }); noise(t, 0.4, 0.08 * v, "highpass", 5200, 0, 0, 0.32); },
        hit: (t, p, v) => { for (let i = 0; i < 6; i++) tone(t + R() * 0.06, (2400 + R() * 1800) * p, 0, 0.26, 0.04 * v); bell(t, 1320 * p, 0.7, 0.05 * v); tone(t, 120, 60, 0.15, 0.3 * v); } },
      bone: { cast: (t, p, v) => { for (let i = 0; i < 6; i++) { const f = (700 + R() * 600) * p; tone(t + i * 0.045, f, f * 0.7, 0.04, 0.15 * v, "triangle"); noise(t + i * 0.045, 0.02, 0.15 * v, "bandpass", 2600, 3); } }, hit: (t, p, v) => { noise(t, 0.05, 0.5 * v, "bandpass", 2200, 2); tone(t, 180 * p, 80, 0.12, 0.35 * v); for (let i = 0; i < 4; i++) tone(t + 0.04 + i * 0.04, (800 + R() * 500) * p, 500, 0.04, 0.1 * v, "triangle"); } },
    };
    // families shape the cast; the school colours it
    const FAMSND = {
      slash: { cast: (t, P, T, p, v) => { if (P.shape === "claw") { for (let i = 0; i < 3; i++) noise(t + 0.18 + i * 0.04, 0.06, 0.3 * v, "bandpass", 2800 * p, 3, 1600 * p); } else if (P.shape === "bite") { tone(t + 0.25, 1600 * p, 800, 0.03, 0.2 * v, "square"); noise(t + 0.27, 0.05, 0.4 * v, "bandpass", 1200, 2); } else { const n = P.shape === "flurry" ? Math.max(2, P.count || 3) : P.shape === "cross" ? 2 : 1; for (let i = 0; i < n; i++) B.whoosh(t + 0.16 + i * 0.09, p * (1 + i * 0.12), v, P.shape === "wide" ? 0.24 : 0.13); } if (T.id === "steel" || T.id === "clang") ring(t + 0.2, 2600 * p, 0.25, 0.03 * v); else if (!["thud", "beast", "bow", "hooves"].includes(T.id)) T.cast(t + 0.12, p, v * 0.5); } },
      thrust: { cast: (t, P, T, p, v) => { if (P.shape === "lance") { TIM.hooves.cast(t, p, v * 0.6); noise(t + 0.2, 0.22, 0.35 * v, "bandpass", 500 * p, 1.2, 2600 * p, 0.15); } else noise(t + 0.18, 0.09, 0.32 * v, "bandpass", 1500 * p, 1.6, 4200 * p, 0.06); if (P.shape === "rapier") noise(t + 0.29, 0.08, 0.28 * v, "bandpass", 1700 * p, 1.6, 4400 * p, 0.05); if (T.id !== "thud" && T.id !== "steel" && T.id !== "bow") T.cast(t + 0.1, p, v * 0.5); } },
      smash: { cast: (t, P, T, p, v) => { noise(t + 0.08, 0.3, 0.3 * v, "bandpass", 260 * p, 1, 900 * p, 0.25); if (T.id !== "thud" && T.id !== "steel") T.cast(t + 0.1, p, v * 0.5); }, hit: (t, P, T, p, v) => { B.heavy(t, p, v); if (P.shape === "quake") noise(t - 0.15, 0.6, 0.25 * v, "lowpass", 160, 1, 60, 0.15); if (T.id !== "thud") T.hit(t, p, v * 0.6); } },
      arrow: { cast: (t, P, T, p, v) => { const n = P.shape === "volley" ? 5 : 1; for (let i = 0; i < n; i++) { const at = t + 0.14 + i * 0.045; if (P.shape === "sling") { noise(t, 0.3, 0.12 * v, "bandpass", 500 * p, 3); noise(at, 0.06, 0.2 * v, "bandpass", 1800, 2); } else if (P.shape === "throw") B.whoosh(at, p * 1.3, v * 0.7, 0.1); else if (P.shape === "bolt") { noise(at, 0.03, 0.4 * v, "bandpass", 1500, 2); tone(at, 130 * p, 80, 0.1, 0.35 * v); } else TIM.bow.cast(at, p * (1 + i * 0.03), v * (n > 1 ? 0.6 : 1)); } if (T.id !== "bow" && T.id !== "thud" && T.id !== "steel") T.cast(t + 0.16, p, v * 0.35); }, hit: (t, P, T, p, v) => { TIM.bow.hit(t, p, v); if (T.id !== "bow" && T.id !== "thud") T.hit(t, p, v * 0.5); } },
      bolt: { cast: (t, P, T, p, v) => { T.cast(t, p, v); if (P.shape === "strike") noise(t + 0.3, 0.15, 0.1 * v, "highpass", 3000, 0, 0, 0.1); else noise(t + 0.3, 0.18, 0.12 * v, "bandpass", 900 * p, 1, 2400 * p, 0.04); }, hit: (t, P, T, p, v) => { T.hit(t, p, P.shape === "swarm" ? v * 0.7 : v); if (P.shape === "swarm") for (let i = 1; i < 4; i++) T.hit(t + i * 0.06, p * (1 + i * 0.05), v * 0.35); if (P.shape === "lob") tone(t, 70, 35, 0.3, 0.35 * v); } },
      beam: { cast: (t, P, T, p, v) => { T.cast(t, p, v * 0.8); wob(t + 0.35, (P.shape === "pillar" ? 180 : 140) * p, (P.shape === "pillar" ? 170 : 160) * p, 0.6, 0.08 * v, "sawtooth", 31, 0.5, 1600); noise(t + 0.35, 0.6, 0.08 * v, "bandpass", 2400 * p, 1, 2000 * p, 0.05); }, hit: (t, P, T, p, v) => T.hit(t, p, v) },
      nova: { cast: (t, P, T, p, v) => { T.cast(t, p, v); noise(t, 0.4, 0.08 * v, "lowpass", 150, 1, 400, 0.3); }, hit: (t, P, T, p, v) => { T.hit(t, p, v); if (P.shape === "rain" || P.shape === "storm") for (let i = 1; i < 5; i++) T.hit(t + i * 0.09 + R() * 0.04, p * (0.95 + R() * 0.1), v * 0.4); tone(t, 60, 30, 0.5, 0.35 * v); } },
      heal: { cast: (t, P, T, p, v) => { T.cast(t, p, v); }, hit: (t, P, T, p, v) => { TIM.heal.hit(t, p, v); if (T.id !== "heal") T.cast(t, p * 1.1, v * 0.5); } },
      buff: { cast: (t, P, T, p, v) => { if (P.shape === "vanish") { noise(t + 0.2, 0.35, 0.3 * v, "lowpass", 2400, 1, 200); tone(t + 0.25, 600 * p, 200, 0.2, 0.05 * v); } else if (P.shape === "shout") (T.id === "roar" || T.id === "beast" ? TIM.roar : TIM.horn).cast(t + 0.1, p, v); else if (P.shape === "rage") { TIM.roar.cast(t + 0.05, p, v); B.crackle(t + 0.2, 0.4, v * 0.6); } else { T.cast(t, p, v * 1.2); noise(t + 0.15, 0.3, 0.12 * v, "bandpass", 600 * p, 1.2, 2800 * p, 0.22); [523, 784, 1046].forEach((f, i) => tone(t + 0.3 + i * 0.07, f * p, f * p * 1.5, 0.2, 0.12 * v, "triangle", 0.01)); } }, hit: () => {} },
      summon: { cast: (t, P, T, p, v) => { T.cast(t, p, v * 0.8); if (P.shape === "call") { tone(t + 0.1, 1800 * p, 2400 * p, 0.12, 0.06 * v); tone(t + 0.25, 1800 * p, 1200 * p, 0.2, 0.06 * v); TIM.hooves.cast(t + 0.3, p * 1.2, v * 0.5); } else if (P.shape === "rise") noise(t + 0.4, 0.5, 0.3 * v, "lowpass", 140, 1, 500, 0.2); else wob(t + 0.15, 110 * p, 220 * p, 0.6, 0.14 * v, "triangle", 9, 0.5, 2000); }, hit: (t, P, T, p, v) => { if (P.shape === "puff") noise(t, 0.3, 0.4 * v, "lowpass", 3000, 1, 300); else if (P.shape === "circle") { bell(t, 660 * p, 0.9, 0.14 * v); tone(t, 90, 50, 0.3, 0.3 * v); } else B.thud(t, p, v * 0.7); } },
      curse: { cast: (t, P, T, p, v) => { if (P.shape === "dread") { tone(t + 0.2, 60 * p, 35, 0.6, 0.5 * v); TIM.death.cast(t, p * 1.2, v * 0.7); } else if (P.shape === "mark") { for (let i = 0; i < 3; i++) tone(t + 0.15 + i * 0.09, 1600 * p, 1600 * p, 0.05, 0.16 * v, "square", 0.001, 3000); } else if (P.shape === "bind") { if (T.id === "steel" || T.id === "clang" || T.id === "craft" || T.id === "thud" || T.id === "horn" || T.id === "coin") for (let i = 0; i < 7; i++) B.clink(t + 0.2 + i * 0.04, (1200 + R() * 800) * p, 0.6 * v); else T.cast(t, p, v); } else T.cast(t, p * 0.9, v); }, hit: (t, P, T, p, v) => { if (P.shape === "mark") { tone(t, 2200 * p, 2200 * p, 0.14, 0.18 * v, "square", 0.001, 3000); tone(t, 110, 60, 0.12, 0.3 * v); } else { tone(t, 90 * p, 45, 0.3, 0.35 * v); T.hit(t, p * 0.8, v * 0.5); } } },
      guard: { cast: (t, P, T, p, v) => { if (P.shape === "parry") return; if (P.shape === "wall") noise(t + 0.1, 0.3, 0.35 * v, "lowpass", 200, 1, 900, 0.2); else noise(t + 0.08, 0.2, 0.08 * v, "highpass", 5000, 0, 0, 0.1); T.cast(t + 0.05, p, v * 0.5); }, hit: (t, P, T, p, v) => { if (P.shape === "parry") { ring(t, 1250 * p, 0.6, 0.12 * v); noise(t, 0.05, 0.5 * v, "highpass", 3000); } else if (P.shape === "wall") TIM[T.id === "ice" ? "ice" : "clang"].hit(t, p * 0.8, v * 0.5); else { ring(t, 880 * p, 0.6, 0.07 * v); tone(t, 140, 80, 0.12, 0.3 * v); } } },
    };
    for (const id in TIM) TIM[id].id = id;
    // the rework's shapes carry their own sound; the school still colours it
    const SHAPESND = {
      decoy: { cast: (t, P, T, p, v) => { TIM.illusion.cast(t + 0.15, p, v); noise(t + 0.3, 0.25, 0.12 * v, "bandpass", 3000 * p, 2, 6000 * p, 0.04); } },
      anthem: { cast: (t, P, T, p, v) => { [0, 2, 4, 7, 4, 9].forEach((n, i) => B.pluck(t + 0.1 + i * 0.06, 330 * p * (n > 7 ? 2 * NOTES[n - 8] : NOTES[n % 8]), v)); if (T.id !== "song") T.cast(t, p, v * 0.4); },
        hit: (t, P, T, p, v) => { [0, 4, 7].forEach((n, i) => tone(t + i * 0.02, 392 * p * NOTES[n % 8] * (n > 6 ? 1 : 1), 0, 0.5, 0.09 * v, "triangle", 0.01)); } },
      strings: { cast: (t, P, T, p, v) => { for (let i = 0; i < 3; i++) B.pluck(t + 0.25 + i * 0.1, (196 + i * 37) * p, v * 0.8, 0.5); T.cast(t, p, v * 0.4); },
        hit: (t, P, T, p, v) => { B.pluck(t, 147 * p, v, 0.7); B.pluck(t + 0.12, 165 * p, v * 0.6, 0.6); } },
      swirl: { cast: (t, P, T, p, v) => { T.cast(t, p, v * 0.6); wob(t + 0.2, 300 * p, 600 * p, 0.35, 0.06 * v, "sine", 9, 0.8, 3000); },
        hit: (t, P, T, p, v) => { wob(t, 700 * p, 250 * p, 0.5, 0.08 * v, "triangle", 12, 0.7, 3000); tone(t, 110, 60, 0.12, 0.25 * v); } },
      phantasm: { cast: (t, P, T, p, v) => { noise(t, 0.6, 0.25 * v, "lowpass", 120, 1, 700, 0.5); wob(t + 0.25, 70 * p, 46 * p, 0.6, 0.2 * v, "sawtooth", 7, 0.6, 500); },
        hit: (t, P, T, p, v) => { tone(t, 58 * p, 30, 0.7, 0.55 * v); noise(t, 0.4, 0.2 * v, "bandpass", 700, 1.5, 300); T.hit(t, p * 0.8, v * 0.4); } },
      mirrors: { cast: (t, P, T, p, v) => { for (let i = 0; i < 5; i++) tone(t + 0.2 + i * 0.05, (1800 + i * 260) * p, 0, 0.3, 0.05 * v); T.cast(t, p, v * 0.4); },
        hit: (t, P, T, p, v) => { ring(t, 2200 * p, 0.5, 0.06 * v); noise(t, 0.08, 0.3 * v, "highpass", 4000); } },
      snare: { cast: (t, P, T, p, v) => { noise(t + 0.3, 0.2, 0.25 * v, "bandpass", 900 * p, 2, 3200 * p, 0.15); },
        hit: (t, P, T, p, v) => { noise(t, 0.05, 0.4 * v, "bandpass", 1600, 2); tone(t, 160 * p, 80, 0.12, 0.35 * v); if (T.id === "wild") TIM.wild.hit(t, p, v * 0.4); } },
      jaws: { cast: (t, P, T, p, v) => { B.whoosh(t + 0.2, p * 0.9, v * 0.6, 0.2); },
        hit: (t, P, T, p, v) => { ring(t, 760 * p, 0.5, 0.11 * v); noise(t, 0.05, 0.5 * v, "highpass", 2500); tone(t, 140, 70, 0.15, 0.4 * v); for (let i = 0; i < 3; i++) B.clink(t + 0.06 + i * 0.05, (1500 + R() * 400) * p, v * 0.4); } },
      deadfall: { cast: (t, P, T, p, v) => { for (let i = 0; i < 3; i++) tone(t + 0.15 + i * 0.07, 220 * p, 180 * p, 0.08, 0.08 * v, "sawtooth", 0.01, 900); noise(t + 0.38, 0.05, 0.3 * v, "highpass", 3000); },
        hit: (t, P, T, p, v) => { B.heavy(t, p * 0.9, v); noise(t, 0.1, 0.3 * v, "bandpass", 500, 2); tone(t + 0.15, 90, 50, 0.2, 0.25 * v); } },
    };
    const PITCH = [1, 0.84, 1.19, 0.71];
    const IMPACT_AT = { slash: 0.3, thrust: 0.3, smash: 0.45, arrow: 0.4, bolt: 0.55, beam: 0.4, nova: 0.48, heal: 0.45, buff: 0.35, summon: 0.8, curse: 0.47, guard: 0.26 };
    function fam(f, p, phase, at) {
      const P = params(p), S = school(P), T = TIM[S.snd] || TIM.thud, pitch = PITCH[P.sound] * (0.97 + R() * 0.06), F = FAMSND[f] || {}, v = 1;
      const Q = { shape: (FAM[f] && FAM[f].shapes.includes(P.shape)) ? P.shape : FAM[f] ? FAM[f].shapes[0] : null, count: P.count };
      const SS = SHAPESND[Q.shape];
      if (phase !== "impact") { if (SS && SS.cast) SS.cast(at, Q, T, pitch, v); else if (F.cast) F.cast(at, Q, T, pitch, v); else T.cast(at, pitch, v); }
      if (phase !== "cast") {
        const ht = phase === "impact" ? at : at + (IMPACT_AT[f] || 0.4) / P.speed;
        if (P.miss && f !== "heal" && f !== "buff" && f !== "summon" && f !== "guard") STING.miss(ht, 1, 1);
        else if (SS && SS.hit) SS.hit(ht, Q, T, pitch, v); else if (F.hit) F.hit(ht, Q, T, pitch, v); else T.hit(ht, pitch, v);
        if (P.crit) STING.crit(ht + 0.01, 1, 0.8);
      }
    }
    const STING = {
      hit: (t, p, v) => B.thud(t, p, v),
      heavy: (t, p, v) => B.heavy(t, p, v),
      crit: (t, p, v) => { B.heavy(t, p, v); ring(t, 2100 * p, 0.5, 0.06 * v); noise(t, 0.04, 0.5 * v, "highpass", 4000); tone(t + 0.02, 70, 28, 0.5, 0.45 * v); },
      ko: (t, p, v) => { tone(t, 70 * p, 26, 0.8, 0.75 * v); noise(t, 0.6, 0.5 * v, "lowpass", 800, 1, 90); tone(t + 0.05, 320 * p, 70, 0.6, 0.08 * v, "square", 0.005, 1200); ring(t + 0.03, 180 * p, 1.2, 0.08 * v); },
      miss: (t, p, v) => noise(t, 0.16, 0.22 * v, "bandpass", 2400 * p, 1.5, 700 * p, 0.05),
      block: (t, p, v) => TIM.clang.hit(t, p, v),
      heal: (t, p, v) => TIM.heal.hit(t, p, v * 0.8),
      tick: (t, p, v) => { tone(t, 300 * p, 200, 0.08, 0.15 * v, "triangle"); noise(t, 0.05, 0.1 * v, "bandpass", 1500, 2); },
      stamp: (t, p, v) => { tone(t, 110 * p, 55, 0.2, 0.45 * v); noise(t, 0.06, 0.35 * v, "bandpass", 1800, 2); },
      whoosh: (t, p, v) => B.whoosh(t, p, v),
    };
    function sting(kind, sch, at) {
      const S = school(params({ school: sch })), T = TIM[S.snd];
      (STING[kind] || STING.hit)(at, 0.96 + R() * 0.08, 1);
      if (T && sch && (kind === "hit" || kind === "heavy" || kind === "crit") && T.id !== "thud") T.hit(at, 1, 0.45);
    }
    function render(evs, secs, sr) {
      const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext, rate = sr || 22050;
      const saved = [ac, out, nb];
      ac = new OAC(1, Math.ceil(rate * secs), rate);
      out = ac.createGain(); out.gain.value = 0.7 * 0.6 * 0.9; out.connect(ac.destination);
      nb = noiseBuf(ac);
      const off = ac;
      try { for (const [t, kind, name, p, phase] of evs) kind === "sting" ? sting(name, p && p.school, t + 0.01) : fam(name, p, phase || "all", t + 0.01); } finally { [ac, out, nb] = saved; }
      return off.startRendering();
    }
    function play(fn) { const c = ok(); if (!c) return; try { fn(); } catch (e) { /* audio node limits */ } }
    if (root.document) {
      root.document.addEventListener("pointerdown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("keydown", () => { unlocked = true; }, { capture: true });
      root.document.addEventListener("visibilitychange", () => { if (ac && root.document.hidden) ac.suspend(); });
    }
    return {
      fam: (f, p, phase, delay) => play(() => fam(f, p, phase || "all", ac.currentTime + 0.01 + (delay || 0))),
      sting: (kind, sch, delay) => play(() => sting(kind, sch, ac.currentTime + 0.01 + (delay || 0))),
      render, get ready() { return open() && prefs().on; }, unlock() { unlocked = true; },
    };
  })();

  // ---------- the public face ----------
  let lastKey = null, lastX = null;
  function X_(fam, p, from, to) {
    const tl = Array.isArray(to) ? to : [to];
    if (lastKey && lastKey.fam === fam && lastKey.p === p && lastKey.from === from && lastKey.to === to && lastKey.fx === from.x && lastKey.fy === from.y &&
        lastKey.tx.length === tl.length && tl.every((q, i) => !q || (q.x === lastKey.tx[i] && q.y === lastKey.ty[i]))) return lastX;
    lastX = setup(fam, p, from, to);
    lastKey = { fam, p, from, to, fx: from.x, fy: from.y, tx: tl.map((q) => q && q.x), ty: tl.map((q) => q && q.y) };
    return lastX;
  }
  function timing(fam, p, from, to) {
    from = from || { x: 0, y: 0 };
    const X = X_(fam, p, from, to), s = X.P.speed, T = X.T;
    const marks = (X.F.marks ? X.F.marks(X) : []).map((m) => Object.assign({}, m, { at: m.at / s }));
    return { dur: T.dur / s, impact: Math.min(...T.impacts) / s, impacts: T.impacts.map((v) => v / s), windup: T.windup / s, marks };
  }
  function play(ctx, fam, p, from, to, t, layer) {
    if (!ctx || !from) return false;
    const X = X_(fam, p, from, to), u = t * X.P.speed;
    if (u < 0 || u > X.T.dur) return false;
    use(ctx);
    X.F.draw(X, u, layer === "floor" ? "floor" : "fx");
    return true;
  }
  function pose(fam, p, role, t, from, to, i) {
    const o = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, white: 0, alpha: 1, tint: null, tintAmt: 0 };
    if (!from) return o;
    const X = X_(fam, p, from, to), u = t * X.P.speed;
    if (u < 0 || u > X.T.dur) return o;
    X.F.pose(X, role === "target" ? "target" : "actor", u, i | 0, o);
    if (reduced()) { o.dx *= 0.5; o.dy *= 0.5; o.white *= 0.5; }
    return o;
  }

  root.FightFX = {
    FAMILIES: Object.fromEntries(Object.keys(FAM).map((f) => [f, { shapes: FAM[f].shapes.slice(), about: FAM[f].about }])),
    SCHOOLS: Object.fromEntries(Object.keys(SCHOOLS).map((s) => [s, { pal: SCHOOLS[s].pal.slice(), particle: SCHOOLS[s].p, decal: SCHOOLS[s].decal, sound: SCHOOLS[s].snd }])),
    ALIASES: Object.assign({}, ALIAS),
    STATUSES: ["burn", "chill", "stun", "weaken", "blind", "poison", "marked", "charm", "bleed", "guard", "stealth"],
    DECALS: Object.keys(DECAL),
    NUMBER_STYLES: Object.keys(NUM),
    HITSTOP: { hit: 4 / 60, heavy: 6 / 60, crit: 8 / 60, ko: 10 / 60 },
    config(o) { if (o && o.flat > 0) FLAT = +o.flat; if (o && o.scale > 0) SCALE = +o.scale; lastKey = null; return { flat: FLAT, scale: SCALE }; },
    params: (p) => Object.assign({}, params(p)),
    school: (id) => school(params({ school: id })).id,
    chest, timing, play, pose,
    ring(ctx, x, y, r, t, p, mode) { use(ctx); return ringDraw(x, y, r, t, params(p), mode === "tell" ? "tell" : "hit"); },
    hitStop(kind) { return this.HITSTOP[kind] || 0; },
    shake, flash, silhouette, reduced,
    sparks(ctx, x, y, t, o) {
      o = o || {};
      const P = params({ school: o.school, crit: o.crit, seed: o.seed }), S = school(P);
      use(ctx);
      burst({ S, pal: S.pal, k: (o.size || 1) * SCALE, P, seed: P.seed | 0 }, x, y, t, o.dir || 1, (o.count || 9) / 9, o.kind);
      return t < 0.6;
    },
    number(ctx, style, txt, x, y, t) { use(ctx); return number(style, txt, x, y, t); },
    stamp,
    status(ctx, st, p, t) { use(ctx); return status(st, p, t); },
    text(ctx, str, x, y, col, sc, ol, align) { use(ctx); text(str, x, y, col || "#f6ebd0", sc || 1, ol, align || "c"); },
    floor,
    sound(fam, p, phase, delay) { Snd.fam(fam, p, phase, delay); },
    sting(kind, sch, delay) { Snd.sting(kind, sch, delay); },
    audio: { render: Snd.render, unlock: Snd.unlock, get ready() { return Snd.ready; } },
  };
})(window);
