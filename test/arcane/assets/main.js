/* Arcane: reveals, email assembly */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Staggered text reveal ------------------------------------------- */
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-r]'));
  // Begin once the web fonts are in (or after 400ms at most), so the cascade
  // plays on the final typography instead of a fallback swap.
  var begun = false;
  function begin() {
    if (begun) return;
    begun = true;
    reveal();
    requestAnimationFrame(function () { doc.classList.add('is-lit'); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin, begin);
  setTimeout(begin, 400);

  function reveal() {
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
  } else {
    // Hero items resolve as a quick cascade; the rest as they enter view.
    var hero = document.querySelector('.hero');
    var i = 0;
    els.forEach(function (el) {
      if (hero.contains(el) && !el.style.getPropertyValue('--d')) {
        el.style.setProperty('--d', (60 + i++ * 70) + 'ms');
      }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden.
    setTimeout(function () {
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 1800);
  }
  }

  /* ---- Email ------------------------------------------------------------ */
  var btn = document.getElementById('mail-btn');
  var out = document.getElementById('mail-out');
  var link = document.getElementById('mail-link');
  var copy = document.getElementById('mail-copy');
  var status = document.getElementById('mail-status');
  if (!btn) return;

  function rev(s) { return s.split('').reverse().join(''); }
  function address() {
    return rev('namdorb' + 'niffirg') + String.fromCharCode(64) + rev('moc.' + 'liamg');
  }

  btn.addEventListener('click', function () {
    var a = address();
    link.textContent = a;
    link.href = rev(':otliam') + a;
    btn.hidden = true;
    out.hidden = false;
    out.classList.add('is-new');
    link.focus({ preventScroll: true });
    status.textContent = 'Email address shown: ' + a;
  });

  var t;
  copy.addEventListener('click', function () {
    var a = address();
    function done(ok) {
      copy.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      copy.classList.toggle('is-done', ok);
      status.textContent = ok ? 'Email address copied to clipboard' : '';
      clearTimeout(t);
      t = setTimeout(function () { copy.textContent = 'Copy'; copy.classList.remove('is-done'); }, 2400);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(a).then(function () { done(true); }, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = a;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (!ok) { var r = document.createRange(); r.selectNodeContents(link); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      done(ok);
    }
  });
})();
