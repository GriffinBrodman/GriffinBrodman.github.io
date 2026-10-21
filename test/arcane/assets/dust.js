/* Arcane: gold dust in lamplight.
   Motes drift slowly through a faint shaft of light. Depth of field: motes near the
   focal plane are fine points, near and far ones become soft discs. Pointer and scroll
   add gentle parallax; the pointer also disturbs the air a little. */
(function () {
  'use strict';
  var canvas = document.getElementById('dust');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0, H = 0, DPR = 1, motes = [], sprites = [];
  var colL = 0, colR = 0, orb = null;              // text column + astrolabe, for dimming
  var LEVELS = 7, FOCUS = 0.42;
  var px = 0.5, py = 0.5, tpx = 0.5, tpy = 0.5;   // pointer, normalised and smoothed
  var mx = -9999, my = -9999, lastMove = 0;      // raw pointer
  var running = false, last = 0, t = 0, raf = 0;

  // Pre-rendered mote sprites, from crisp (0) to very soft bokeh (LEVELS-1).
  function makeSprites() {
    sprites = [];
    for (var k = 0; k < LEVELS; k++) {
      var s = 64, c = document.createElement('canvas');
      c.width = c.height = s;
      var g = c.getContext('2d');
      var f = k / (LEVELS - 1);
      var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      if (k === 0) {
        grd.addColorStop(0, 'rgba(255,244,214,1)');
        grd.addColorStop(0.18, 'rgba(240,214,160,.85)');
        grd.addColorStop(0.45, 'rgba(220,186,120,.18)');
        grd.addColorStop(1, 'rgba(220,186,120,0)');
      } else {
        // soft disc with a faint brighter rim, like out-of-focus highlights
        var edge = 0.98 - f * 0.28;
        grd.addColorStop(0, 'rgba(236,212,160,' + (0.55 - f * 0.12) + ')');
        grd.addColorStop(edge * 0.7, 'rgba(236,212,160,' + (0.5 - f * 0.12) + ')');
        grd.addColorStop(edge * 0.92, 'rgba(244,224,178,' + (0.62 - f * 0.18) + ')');
        grd.addColorStop(edge, 'rgba(236,212,160,' + (0.22 - f * 0.08) + ')');
        grd.addColorStop(1, 'rgba(236,212,160,0)');
      }
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
      sprites.push(c);
    }
  }

  // The shaft of light: enters from the upper right, falls to the lower left.
  var B = { x0: 0, y0: 0, dx: 0, dy: 0, nx: 0, ny: 0, w: 1, len: 1 };
  function setupBeam() {
    var ang = (W > H ? 128 : 112) * Math.PI / 180;
    B.x0 = W * (W > H ? 0.9 : 1.0); B.y0 = -H * 0.05;
    B.dx = Math.cos(ang); B.dy = Math.sin(ang);
    B.nx = -B.dy; B.ny = B.dx;
    B.w = Math.max(W, H) * (W > H ? 0.2 : 0.28);
    B.len = Math.hypot(W, H) * 1.1;

  }
  function light(x, y) {
    var rx = x - B.x0, ry = y - B.y0;
    var along = rx * B.dx + ry * B.dy;
    var across = rx * B.nx + ry * B.ny;
    var a = Math.max(0, 1 - along / B.len);
    var k = across / B.w;
    return 0.28 + 0.72 * Math.exp(-k * k) * (0.35 + 0.65 * a);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(m, anywhere) {
    var z = Math.pow(Math.random(), 1.35);          // more far motes than near ones
    m.z = z;
    m.x = rand(-40, W + 40);
    m.y = anywhere ? rand(-40, H + 40) : H + rand(20, 80);
    var blur = Math.min(1, Math.abs(z - FOCUS) / (1 - FOCUS));
    m.blur = blur;
    m.lvl = Math.min(LEVELS - 1, Math.round(blur * (LEVELS - 1)));
    m.r = Math.min(6, 0.9 + z * z * 5 + blur * 1.5); // drawn radius (css px)
    if (m.lvl === 0) m.r = rand(1.6, 2.6);
    m.a = (m.lvl === 0 ? rand(.55, .9) : (0.34 - blur * 0.22)) * (1 - z * 0.5);
    m.vy = -rand(2.5, 7) * (0.4 + z);               // px/s, upward
    m.vx = rand(-1.5, 1.5);
    m.ex = 0; m.ey = 0;                              // air disturbance
    m.ph = rand(0, Math.PI * 2);
    m.fq = rand(0.05, 0.16);
    m.sw = rand(4, 14) * (0.5 + z);
    m.tw = rand(0.15, 0.6);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    var n = Math.round(Math.min(70, Math.max(28, (W * H) / 20000)));
    if (motes.length > n) motes.length = n;
    while (motes.length < n) { var m = {}; spawn(m, true); motes.push(m); }
    setupBeam();
    measure();
  }

  // Motes over the text are dimmed so they never read as specks on the words.
  function measure() {
    var main = document.querySelector('main');
    var r = main ? main.getBoundingClientRect() : { left: 0, right: W };
    colL = r.left; colR = r.right;
    var o = document.querySelector('.orrery');
    if (o) { var q = o.getBoundingClientRect(); orb = { x: q.left + q.width / 2, y: q.top + q.height / 2 + (window.scrollY || 0), r: q.width / 2 }; }
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function draw(dt) {
    var sy = window.scrollY || 0;
    px += (tpx - px) * Math.min(1, dt * 1.6);
    py += (tpy - py) * Math.min(1, dt * 1.6);
    var pointerLive = (performance.now() - lastMove) < 1200;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    var span = H + 160;
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      if (dt > 0) {
        m.y += m.vy * dt;
        m.x += (m.vx + Math.sin(t * m.fq * 6.283 + m.ph) * m.sw * 0.25) * dt;
        m.x += m.ex * dt; m.y += m.ey * dt;
        m.ex *= Math.pow(0.35, dt); m.ey *= Math.pow(0.35, dt);
      }
      // parallax: scroll and pointer move nearer motes further
      var par = 0.06 + m.z * 0.34;
      var X = m.x + (0.5 - px) * (8 + m.z * 46);
      var Y = m.y - sy * par + (0.5 - py) * (6 + m.z * 30);
      Y = ((Y + 80) % span + span) % span - 80;
      if (m.x < -60) m.x += W + 120; else if (m.x > W + 60) m.x -= W + 120;

      if (pointerLive && dt > 0 && m.z > 0.25) {
        var ddx = X - mx, ddy = Y - my, d2 = ddx * ddx + ddy * ddy;
        if (d2 < 22000 && d2 > 1) {
          var f = (1 - d2 / 22000) * 26 * dt * 60 / Math.sqrt(d2);
          m.ex += ddx * f * 0.05; m.ey += ddy * f * 0.05;
        }
      }

      var lum = light(X, Y);
      var tw = 1 - m.tw * 0.5 + m.tw * 0.5 * Math.sin(t * (0.6 + m.fq * 4) + m.ph * 3);
      var a = m.a * lum * tw;
      if (X > colL && X < colR) {
        var inOrb = orb && Math.hypot(X - orb.x, Y + sy - orb.y) < orb.r;
        if (!inOrb) a *= 0.45;
      }
      if (a < 0.01) continue;
      var r = m.r * (m.lvl === 0 ? 3.2 : 1.15);
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprites[m.lvl], X - r, Y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function start() {
    if (running || reduce.matches || document.hidden) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function still() { stop(); draw(0); }

  makeSprites();
  resize();
  if (reduce.matches) still(); else start();

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { resize(); if (!running) draw(0); }, 120);
  }, { passive: true });
  window.addEventListener('scroll', function () { if (!running) draw(0); }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    tpx = e.clientX / W; tpy = e.clientY / H;
    mx = e.clientX; my = e.clientY; lastMove = performance.now();
  }, { passive: true });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  (reduce.addEventListener ? reduce.addEventListener.bind(reduce, 'change') : reduce.addListener.bind(reduce))(function () {
    reduce.matches ? still() : start();
  });
})();
