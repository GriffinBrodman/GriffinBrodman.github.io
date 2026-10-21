/* Arcane: an engraved brass astrolabe around the portrait.
   The plate is a real stereographic projection for Buffalo's latitude (42.9° N).
   Once the fonts are in, it engraves itself with a sweep of light; then the rete turns
   slowly (one revolution every ninety seconds) while the light on the brass follows the pointer. */
(function () {
  'use strict';
  var canvas = document.getElementById('astrolabe');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!ctx.createConicGradient) { canvas.classList.add('no-conic'); }

  var D2R = Math.PI / 180;
  var LAT = 42.9, OBL = 23.44;
  var R_LIMB_IN = 0.86, R_CAP = 0.80;
  var R_EQ = R_CAP / Math.tan((90 + OBL) / 2 * D2R);
  var R_CAN = R_EQ * Math.tan((90 - OBL) / 2 * D2R);
  var R_PHOTO = 0.392;                       // portrait (37% of box) + its shadow ring
  var R_RING_IN = 0.405, R_RING_OUT = 0.452; // engraved ring around the portrait

  var INK = '216,188,128';                   // brass line colour (rgb)
  var S = 0, DPR = 1, R0 = 1, SMALL = false, MASTER = 0.78;
  var mat, rete, art, glint, limb, plate, ring, tmp;                 // offscreen layers
  var visible = true, running = false, raf = 0;
  var t0 = 0, last = 0, rot = 0, ready = false;
  
  var INTRO = 2.9;                           // seconds for the draw-on sweep
  var lightA = -55 * D2R, lightT = lightA, lastPointer = -1e9, orbitV = 0;

  function mk() { return document.createElement('canvas'); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  /* ---------- drawing helpers (unit space: radius 1 = R0) --------------- */
  function px(n) { return n / R0; }
  function circle(g, r, a, w, cx, cy) {
    g.globalAlpha = a; g.lineWidth = px(w || 1);
    g.beginPath(); g.arc(cx || 0, cy || 0, r, 0, Math.PI * 2); g.stroke();
  }
  function ticks(g, r1, r2, step, a, w, skip) {
    g.globalAlpha = a; g.lineWidth = px(w || 1);
    g.beginPath();
    for (var d = 0; d < 360; d += step) {
      if (skip && skip(d)) continue;
      var c = Math.cos(d * D2R), s = Math.sin(d * D2R);
      g.moveTo(c * r1, s * r1); g.lineTo(c * r2, s * r2);
    }
    g.stroke();
  }
  function prep(c) {
    c.width = c.height = Math.round(S * DPR);
    var g = c.getContext('2d');
    g.setTransform(DPR * R0, 0, 0, DPR * R0, S * DPR / 2, S * DPR / 2);
    g.strokeStyle = 'rgb(' + INK + ')';
    g.fillStyle = 'rgb(' + INK + ')';
    g.lineCap = 'round';
    return g;
  }
  function clipAnnulus(g, rin, rout) {
    g.beginPath();
    g.arc(0, 0, rout, 0, Math.PI * 2);
    g.arc(0, 0, rin, 0, Math.PI * 2, true);
    g.clip();
  }

  /* ---------- static mater + plate ------------------------------------- */
  function drawMat() {
    drawLimb(prep(limb));
    drawPlate(prep(plate));
    drawRing(prep(ring));
    var g = mat.getContext('2d');
    mat.width = mat.height = limb.width;
    g.drawImage(limb, 0, 0); g.drawImage(plate, 0, 0); g.drawImage(ring, 0, 0);
  }

  function drawLimb(g) {

    // Limb: double rim, degree scale, hour band
    circle(g, 1.0, 0.75, 1.2);
    circle(g, 0.988, 0.45, 0.7);
    circle(g, 0.93, 0.5, 0.8);
    if (!SMALL) ticks(g, 0.968, 0.988, 1, 0.38, 0.6, function (d) { return d % 5 === 0; });
    ticks(g, 0.952, 0.988, 5, 0.5, 0.7, function (d) { return d % 10 === 0; });
    ticks(g, 0.935, 0.988, 10, 0.62, 0.8);
    circle(g, R_LIMB_IN, 0.5, 0.8);

    // Hour band numerals (I–XII twice), engraved small and tangential
    var hours = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    var fs = Math.max(7.5, R0 * 0.034);
    g.font = '500 ' + px(fs) + 'px "Cormorant Garamond", Garamond, Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var h = 0; h < 24; h++) {
      var ang = -90 + h * 15;
      if (S < 300) { g.globalAlpha = 0.45; var a3 = ang * D2R; g.beginPath(); g.arc(Math.cos(a3) * (R_LIMB_IN + 0.034), Math.sin(a3) * (R_LIMB_IN + 0.034), px(0.9), 0, 7); g.fill(); continue; }
      g.save();
      g.rotate(ang * D2R + Math.PI / 2);
      g.globalAlpha = 0.62;
      g.fillText(hours[h % 12], 0, -(R_LIMB_IN + 0.034));
      g.restore();
      // small dot between numerals
      var a2 = (ang + 7.5) * D2R;
      g.globalAlpha = 0.45;
      g.beginPath(); g.arc(Math.cos(a2) * (R_LIMB_IN + 0.034), Math.sin(a2) * (R_LIMB_IN + 0.034), px(0.9), 0, 7); g.fill();
    }

  }

  function drawPlate(g) {
    // Plate: tropics and equator
    circle(g, R_CAP, 0.62, 1);
    circle(g, R_CAP - 0.012, 0.25, 0.6);
    circle(g, R_EQ, 0.42, 0.8);
    circle(g, R_CAN, 0.36, 0.7);

    // Almucantars, azimuths, horizon, clipped to the plate outside the portrait
    g.save();
    clipAnnulus(g, R_RING_OUT, R_CAP);
    var phi = LAT * D2R;
    function sgnY(y) { return -y; }   // north (zenith) toward the top
    var horizon = null;
    for (var alt = 0; alt <= 80; alt += 5) {
      var yn = R_EQ * Math.tan((alt * D2R - phi) / 2);
      var ys = R_EQ * Math.tan((Math.PI - phi - alt * D2R) / 2);
      var cy = sgnY((yn + ys) / 2), r = Math.abs(ys - yn) / 2;
      if (alt === 0) horizon = { cy: cy, r: r };
      circle(g, r, alt === 0 ? 0.6 : (alt % 10 === 0 ? 0.3 : 0.16), alt === 0 ? 1 : 0.6, 0, cy);
    }
    // twilight line (18° below horizon), dashed
    var yn2 = R_EQ * Math.tan((-18 * D2R - phi) / 2), ys2 = R_EQ * Math.tan((Math.PI - phi + 18 * D2R) / 2);
    if (!SMALL) {
      g.setLineDash([px(2), px(4)]);
      circle(g, Math.abs(ys2 - yn2) / 2, 0.26, 0.6, 0, sgnY((yn2 + ys2) / 2));
      g.setLineDash([]);
    }

    // azimuth arcs, only above the horizon
    g.save();
    g.beginPath(); g.arc(0, horizon.cy, horizon.r, 0, Math.PI * 2); g.clip();
    var yz = R_EQ * Math.tan((Math.PI / 2 - phi) / 2);
    var yd = -R_EQ * Math.tan((Math.PI / 2 + phi) / 2);
    var ym = sgnY((yz + yd) / 2), half = Math.abs(yz - yd) / 2;
    for (var A = 15; A < 180; A += 15) {
      var xc = half / Math.tan(A * D2R);
      var rr = Math.sqrt(half * half + xc * xc);
      circle(g, rr, A === 90 ? 0.26 : 0.15, 0.6, xc, ym);
    }
    g.restore();

    // meridian and east-west line
    g.globalAlpha = 0.3; g.lineWidth = px(0.7);
    g.beginPath(); g.moveTo(0, -R_CAP); g.lineTo(0, R_CAP); g.moveTo(-R_CAP, 0); g.lineTo(R_CAP, 0); g.stroke();
    g.restore();

  }

  function drawRing(g) {
    // Engraved ring around the portrait
    circle(g, R_RING_OUT, 0.7, 1);
    circle(g, R_RING_OUT - 0.008, 0.3, 0.6);
    circle(g, R_RING_IN, 0.55, 0.8);
    ticks(g, R_RING_IN + 0.004, R_RING_IN + 0.02, 3, 0.4, 0.6, function (d) { return d % 15 === 0; });
    ticks(g, R_RING_IN + 0.004, R_RING_OUT - 0.012, 15, 0.6, 0.7);
    // four small lozenges at the cardinal points
    for (var q = 0; q < 4; q++) {
      g.save(); g.rotate(q * Math.PI / 2);
      g.globalAlpha = 0.85;
      var rm = (R_RING_IN + R_RING_OUT) / 2;
      g.beginPath();
      g.moveTo(0, -R_RING_OUT - 0.02); g.lineTo(0.012, -rm); g.lineTo(0, -R_RING_IN + 0.012); g.lineTo(-0.012, -rm); g.closePath();
      g.fill();
      g.restore();
    }
  }

  /* ---------- rotating rete -------------------------------------------- */
  var STARS = [
    // [angle deg (around rete centre), radius of the star]
    [-118, 0.70], [-50, 0.60], [14, 0.74], [76, 0.66], [140, 0.73], [208, 0.58]
  ];
  function drawRete() {
    var g = prep(rete);
    g.save();
    clipAnnulus(g, R_RING_OUT + 0.006, 0.83);

    // rete rim
    circle(g, R_CAP + 0.006, 0.55, 0.9);
    circle(g, R_CAP - 0.03, 0.42, 0.8);

    // ecliptic: tangent to both tropics
    var ed = (R_CAP - R_CAN) / 2, er = (R_CAP + R_CAN) / 2;
    var ecy = -ed;
    circle(g, er, 0.72, 1, 0, ecy);
    circle(g, er - 0.045, 0.5, 0.8, 0, ecy);
    g.save(); g.translate(0, ecy);
    ticks(g, er - 0.045, er, 30, 0.6, 0.8);
    ticks(g, er - 0.022, er, 10, 0.45, 0.6, function (d) { return d % 30 === 0; });
    ticks(g, er - 0.012, er, 2, 0.3, 0.5, function (d) { return d % 10 === 0; });
    g.restore();

    // struts from rim to ecliptic
    g.globalAlpha = 0.45; g.lineWidth = px(0.8);
    g.beginPath();
    [-45, 45, 135, 225].forEach(function (d) {
      var c = Math.cos(d * D2R), s = Math.sin(d * D2R);
      g.moveTo(c * (R_CAP - 0.03), s * (R_CAP - 0.03));
      g.lineTo(c * 0.5, s * 0.5);
    });
    g.stroke();

    // star pointers: straight tapered daggers pointing at their stars
    STARS.forEach(function (st) {
      // small instruments get bolder, filled daggers so they read as pointers, not scratches
      var bold = SMALL || S < 600;
      var a = st[0] * D2R, r = st[1], L = bold ? 0.09 : 0.07, w = bold ? 0.014 : 0.011;
      var c = Math.cos(a), sn = Math.sin(a);
      var tx = c * r, ty = sn * r;                 // tip, at the star
      var bx = c * (r + L), by = sn * (r + L);     // base, toward the rim
      g.globalAlpha = 0.7; g.lineWidth = px(0.7); g.lineJoin = 'miter';
      g.beginPath();
      g.moveTo(bx - sn * w, by + c * w);
      g.lineTo(tx, ty);
      g.lineTo(bx + sn * w, by - c * w);
      g.closePath();
      if (bold) { g.globalAlpha = S >= 520 ? 0.45 : 0.55; g.fill(); } else g.stroke();
      g.globalAlpha = 0.95;
      g.beginPath(); g.arc(tx, ty, px(bold ? 1.4 : 1.2), 0, 7); g.fill();
    });
    g.restore();
  }

  /* ---------- compose ---------------------------------------------------- */
  function build() {
    var w = canvas.clientWidth;
    if (!w) return false;
    S = w;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    R0 = S / 2 * 0.97;
    SMALL = S < 420;
    MASTER = SMALL ? 0.62 : 0.78;
    canvas.width = canvas.height = Math.round(S * DPR);
    mat = mat || mk(); rete = rete || mk(); art = art || mk(); glint = glint || mk();
    limb = limb || mk(); plate = plate || mk(); ring = ring || mk(); tmp = tmp || mk();
    tmp.width = tmp.height = canvas.width;
    art.width = art.height = glint.width = glint.height = canvas.width;
    drawMat(); drawRete();
    return true;
  }

  function conic(g, start) {
    var c = canvas.width / 2;
    return g.createConicGradient ? g.createConicGradient(start, c, c) : null;
  }

  function render(time) {
    var N = canvas.width, c = N / 2;
    var p = reduce.matches ? 1 : Math.min(1, time / INTRO);
    var ep = ease(p);

    if (time >= SETTLE) { renderSettled(); return; }

    // 1. compose line art: plate + turning rete.
    //    During the intro each part engraves itself in turn: a sector of light
    //    sweeps clockwise from the top, outer limb first, then ring, plate and rete.
    var a = art.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'source-over';
    a.clearRect(0, 0, N, N);
    var limbP = seg(time, 0, 1.7);
    if (p >= 1) {
      a.drawImage(mat, 0, 0);
    } else {
      reveal(a, limb, limbP, 0);
      reveal(a, ring, seg(time, 0.2, 1.5), 0);
      reveal(a, plate, seg(time, 0.5, 2.4), 0);
    }
    var rp = seg(time, 1.0, INTRO);
    a.globalAlpha = rp;
    a.translate(c, c); a.rotate(rot - (1 - rp) * 0.6); a.translate(-c, -c);
    a.drawImage(rete, 0, 0);
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalAlpha = 1;
    var sweep = -Math.PI / 2 + limbP * Math.PI * 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, N, N);
    ctx.globalAlpha = MASTER;
    ctx.drawImage(art, 0, 0);
    ctx.globalAlpha = 1;

    // 3. light on the brass: during intro a bright pen-tip at the sweep edge,
    //    afterwards a soft highlight that follows the light direction.
    var L, strength;
    if (time < 1.7) { L = sweep; strength = 1.0; }
    else {
      var k = Math.min(1, (time - 1.7) / 2.2);
      L = sweep + angDelta(sweep, lightA) * ease(k);
      strength = 1.0 - (1 - REST) * ease(k);
    }
    var gr = glintGradient(ctx, L, strength);
    if (!gr) return;
    var gg = glint.getContext('2d');
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.globalCompositeOperation = 'source-over';
    gg.clearRect(0, 0, N, N);
    gg.drawImage(art, 0, 0);
    gg.globalCompositeOperation = 'source-in';
    gg.fillStyle = gr;
    gg.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glint, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  var REST = 0.6;                            // resting glint strength
  var SETTLE = 3.95;                         // intro + light hand-off finished
  function glintGradient(g, L, strength) {
    var gr = conic(g, L - Math.PI);
    if (!gr) return null;
    var hi = 'rgba(255,240,206,';
    gr.addColorStop(0, hi + '0)');
    gr.addColorStop(0.40, hi + '0)');
    gr.addColorStop(0.47, hi + (0.12 * strength) + ')');
    gr.addColorStop(0.5, hi + (0.95 * strength) + ')');
    gr.addColorStop(0.53, hi + (0.12 * strength) + ')');
    gr.addColorStop(0.60, hi + '0)');
    gr.addColorStop(1, hi + '0)');
    return gr;
  }

  // Steady state, every frame: plate and turning rete are drawn straight to the canvas;
  // the highlight is composited only inside the bounding box of the narrow lit wedge.
  function renderSettled() {
    var N = canvas.width, c = N / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, N, N);
    ctx.globalAlpha = MASTER;
    ctx.drawImage(mat, 0, 0);
    ctx.translate(c, c); ctx.rotate(rot); ctx.translate(-c, -c);
    ctx.drawImage(rete, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    var gr = glintGradient(ctx, lightA, REST);
    if (!gr) return;
    // wedge of ±0.1 turn around the light angle (where the gradient is non-zero)
    var half = 0.1 * Math.PI * 2, x0 = c, y0 = c, x1 = c, y1 = c;
    for (var k = 0; k <= 8; k++) {
      var an = lightA - half + (2 * half) * k / 8;
      var px_ = c + Math.cos(an) * c, py_ = c + Math.sin(an) * c;
      if (px_ < x0) x0 = px_; if (px_ > x1) x1 = px_;
      if (py_ < y0) y0 = py_; if (py_ > y1) y1 = py_;
    }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2);
    x1 = Math.min(N, Math.ceil(x1) + 2); y1 = Math.min(N, Math.ceil(y1) + 2);
    var w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    var gg = glint.getContext('2d');
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.globalCompositeOperation = 'source-over';
    gg.clearRect(x0, y0, w, h);
    gg.save();
    gg.beginPath(); gg.rect(x0, y0, w, h); gg.clip();
    gg.drawImage(mat, x0, y0, w, h, x0, y0, w, h);
    gg.translate(c, c); gg.rotate(rot); gg.translate(-c, -c);
    gg.drawImage(rete, 0, 0);
    gg.restore();
    gg.globalCompositeOperation = 'source-in';
    gg.fillStyle = gr;
    gg.fillRect(x0, y0, w, h);
    gg.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glint, x0, y0, w, h, x0, y0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  function seg(time, a, b) {
    if (reduce.matches) return 1;
    return ease(Math.max(0, Math.min(1, (time - a) / (b - a))));
  }
  // draw `layer` into g, masked to a clockwise sector that has swept `e` (0..1) of a turn
  function reveal(g, layer, e, start) {
    if (e <= 0) return;
    if (e >= 1) { g.drawImage(layer, 0, 0); return; }
    var N = tmp.width, x = tmp.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, N, N);
    x.drawImage(layer, 0, 0);
    var m = conic(x, -Math.PI / 2 + start);
    x.globalCompositeOperation = 'destination-in';
    if (m) {
      m.addColorStop(0, 'rgba(0,0,0,1)');
      m.addColorStop(Math.max(0, e - 0.06), 'rgba(0,0,0,1)');
      m.addColorStop(e, 'rgba(0,0,0,0)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = m;
    } else { x.fillStyle = 'rgba(0,0,0,' + e + ')'; }
    x.fillRect(0, 0, N, N);
    g.drawImage(tmp, 0, 0);
  }

  function angDelta(from, to) {
    var d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    if (!t0) t0 = now;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    var time = (now - t0) / 1000;
    rot += dt * Math.PI * 2 / 90;                        // ninety seconds per turn
    // light: follows the pointer while it moves; when idle it makes a slow circuit of
    // the limb: 30s, clockwise like the rete and exactly three times its speed, so the
    // light glides past each star pointer every 45s. Speed eases in after the pointer rests.
    var idle = performance.now() - lastPointer > 3000;
    if (idle && time > SETTLE) {
      orbitV += (Math.PI * 2 / 30 - orbitV) * Math.min(1, dt * 0.8);
      lightA += orbitV * dt;
      lightT = lightA;
    } else {
      orbitV = 0;
      lightA += angDelta(lightA, lightT) * Math.min(1, dt * 1.4);
    }
    // The rete turns every frame (full rAF rate keeps the motion smooth);
    // after the intro only the rete and its glint are redrawn per frame.
    render(time);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !ready || !visible || document.hidden || reduce.matches) return;
    running = true; last = 0;
    if (t0) { t0 = performance.now() - Math.max(INTRO + 2, 0) * 1000; } // resume after intro
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  // The intro waits for the web fonts so it plays in full on a settled page.
  function init() {
    if (!build()) return;
    var go = function () {
      if (ready) return;
      if (S) drawMat();
      requestAnimationFrame(function () {
        ready = true;
        canvas.classList.add('is-ready');
        if (reduce.matches) { lightA = -55 * D2R; render(INTRO + 10); }
        else start();
      });
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go, go);
      setTimeout(go, 2500);
    } else go();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = canvas.getBoundingClientRect();
    lightT = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    lastPointer = performance.now();
  }, { passive: true });
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (canvas.clientWidth !== S) { build(); if (!running && ready) render(INTRO + 10); }
    }, 120);
  }, { passive: true });
  (reduce.addEventListener ? reduce.addEventListener.bind(reduce, 'change') : reduce.addListener.bind(reduce))(function () {
    if (!ready) return;
    if (reduce.matches) { stop(); render(INTRO + 10); } else start();
  });

  init();
})();
