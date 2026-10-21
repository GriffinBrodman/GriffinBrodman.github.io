const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = '/tmp/claude-0/-home-user-GriffinBrodman-github-io/a4ce9ba0-dc29-5a50-8bdd-312aa76c5d90/scratchpad/review/aa4/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--ignore-gpu-blocklist'] });
  const res = [];
  for (const [w, h, d] of [[1440, 900, 1], [390, 844, 2]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d })).newPage();
    await p.goto('http://127.0.0.1:8766/?noadapt'); await p.waitForFunction(() => window.__koiPond); await p.waitForTimeout(1500);
    await p.evaluate(() => window.__koiPond.setReducedMotion(true));
    await p.addStyleTag({ content: '.hidetext, .hidetext * { color: transparent !important; } .hidetext svg{opacity:0}' });
    const sels = ['.eyebrow', '.sub', '.section-label', '.years', '.roles li', '.aside', '.foot span'];
    let n = 0;
    for (const t of [3, 12]) {
      await p.evaluate(s => window.__koiPond.step(s), t);
      const H = await p.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < H; y += h * 0.8) {
        await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
        await p.waitForTimeout(250);
        const boxes = await p.evaluate(sels => {
          const out = [];
          for (const s of sels) document.querySelectorAll(s).forEach(e => {
            const r = e.getBoundingClientRect();
            if (r.top >= 0 && r.bottom <= innerHeight && r.width > 0) out.push({ s, x: r.x, y: r.y, w: r.width, h: r.height, c: getComputedStyle(e).color });
          });
          document.querySelectorAll('.card').forEach(c => c.classList.add('hidetext'));
          return out;
        }, sels);
        const f = OUT + `${w}-${n++}.png`;
        await p.screenshot({ path: f });
        await p.evaluate(() => document.querySelectorAll('.card').forEach(c => c.classList.remove('hidetext')));
        res.push({ f, d, boxes });
      }
    }
  }
  require('fs').writeFileSync(OUT + 'boxes.json', JSON.stringify(res));
  await b.close();
})();
