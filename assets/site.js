(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- email: assembled only on request ---------- */
  var btn = document.getElementById('email-btn');
  var box = document.getElementById('email-reveal');
  if (btn && box) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      if (open) { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
      if (!box.firstChild) {
        var parts = ['moc', 'liamg', 'namdorb', 'niffirg'];
        var rev = function (s) { return s.split('').reverse().join(''); };
        var addr = rev(parts[3]) + rev(parts[2]) + String.fromCharCode(64) + rev(parts[1]) + '.' + rev(parts[0]);
        var a = document.createElement('a');
        a.href = 'mai' + 'lto:' + addr;
        a.textContent = addr;
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn';
        copy.textContent = 'Copy';
        copy.addEventListener('click', function () {
          var done = function () {
            copy.textContent = 'Copied';
            setTimeout(function () { copy.textContent = 'Copy'; }, 2200);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(addr).then(done, function () { fallbackCopy(addr); done(); });
          } else { fallbackCopy(addr); done(); }
        });
        box.appendChild(a);
        box.appendChild(copy);
      }
      box.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    });
  }
  function fallbackCopy(text) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(t);
  }

  /* ---------- pond ---------- */
  var canvas = document.querySelector('canvas.pond');
  if (!canvas || !window.KoiPond) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  if (reduced) root.classList.add('reduced');
  var params = new URLSearchParams(location.search);

  var hint = document.querySelector('.pond-hint');
  var hideHint = function () { if (hint) hint.classList.add('is-done'); };
  setTimeout(hideHint, 10000);

  var pond = window.KoiPond.mount(canvas, {
    reducedMotion: reduced,
    adaptive: !params.has('noadapt'),
    // Koi favour water that is actually visible: beside the content column on wide
    // screens, and the band above the hero card on tablets and phones.
    prefer: function (w, h) {
      return w > 980 ? { x0: Math.min(w * 0.5, 720), x1: w, y0: 0, y1: h } : { x0: 0, x1: w, y0: 0, y1: h * 0.42 };
    },
    isUi: function (el) {
      return !!(el && el.closest && el.closest('[data-ui], a, button, input, textarea, label, select'));
    },
    onFeed: hideHint,
    onReady: function () {
      root.classList.add('has-pond');
      requestAnimationFrame(function () { canvas.classList.add('is-ready'); });
    },
    onLost: function () { root.classList.remove('has-pond'); canvas.classList.remove('is-ready'); },
    onRestore: function () { root.classList.add('has-pond'); canvas.classList.add('is-ready'); },
    onFail: function () { root.classList.remove('has-pond'); root.classList.add('no-pond'); canvas.style.display = 'none'; }
  });
  window.__koiPond = pond;
  if (pond && mq) {
    var onChange = function (e) {
      root.classList.toggle('reduced', e.matches);
      pond.setReducedMotion(e.matches);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
})();
