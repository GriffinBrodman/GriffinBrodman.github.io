const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = '/tmp/claude-0/-home-user-GriffinBrodman-github-io/a4ce9ba0-dc29-5a50-8bdd-312aa76c5d90/scratchpad/hifi/koi/review-shots/r4/';
const URL = 'http://127.0.0.1:8766/?noadapt';
async function open(b, w, h, dsf, reduce) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  p.on('pageerror', e => logs.push('pageerror ' + e.message));
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__koiPond);
  await p.waitForTimeout(1800);
  if (!reduce) await p.evaluate(() => window.__koiPond.setReducedMotion(true)); // freeze loop, step manually
  await p.evaluate(() => { document.documentElement.classList.remove('reduced'); });
  p._logs = logs;
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--ignore-gpu-blocklist', '--proxy-server=https=' + (process.env.HTTPS_PROXY||'').replace(/^https?:\/\//,'')] });
  const mode = process.argv[2];
  if (mode === 'views') {
    for (const [w, h, d, tag] of [[1440, 900, 1, 'd'], [768, 1024, 2, 't'], [390, 844, 2, 'p']]) {
      const p = await open(b, w, h, d);
      for (const t of [0, 3, 10, 25]) {
        if (t) await p.evaluate(s => window.__koiPond.step(s), t === 3 ? 3 : t === 10 ? 7 : 15);
        await p.screenshot({ path: OUT + `${tag}-t${t}.png` });
      }
      const H = await p.evaluate(() => document.body.scrollHeight);
      let i = 0;
      for (let y = h * 0.9; y < H; y += h * 0.85) {
        await p.evaluate(y => scrollTo({top:y,behavior:'instant'}), y);
        await p.waitForTimeout(400);
        await p.screenshot({ path: OUT + `${tag}-scroll${i++}.png` });
      }
      const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth, JSON.stringify(window.__koiPond.stats)]);
      console.log(tag, sw.join(' '), p._logs.join('|') || 'no errors');
      await p.context().close();
    }
  }
  if (mode === 'zoom') {
    const p = await open(b, 900, 700, 2);
    await p.evaluate(() => { document.querySelector('.page').style.visibility='hidden'; window.__koiPond.step(6); });
    await p.screenshot({ path: OUT + 'z-full.png' });
    const fish = await p.evaluate(() => window.__koiPond.debugFish());
    console.log(JSON.stringify(fish));
    let n = 0;
    for (const f of fish) {
      const cx = (f.x + f.tx) / 2, cy = (f.y + f.ty) / 2;
      const x = Math.max(0, Math.min(900 - 260, cx - 130)), y = Math.max(0, Math.min(700 - 200, cy - 100));
      await p.screenshot({ path: OUT + `z-koi${n++}.png`, clip: { x, y, width: 260, height: 200 } });
    }
    // motion sequence of fish 0 at 1/30s
    const f0 = fish.find(f => f.x > 480) || fish[0];
    for (let i = 0; i < 10; i++) {
      await p.evaluate(() => window.__koiPond.step(1 / 30));
      const g = (await p.evaluate(() => window.__koiPond.debugFish())).find((f, k) => k === fish.indexOf(f0));
      const cx = (g.x + g.tx) / 2, cy = (g.y + g.ty) / 2;
      await p.screenshot({ path: OUT + `seq-${i}.png`, clip: { x: Math.max(0, Math.min(640, cx - 130)), y: Math.max(0, Math.min(500, cy - 100)), width: 260, height: 200 } });
    }
    console.log(p._logs.join('|') || 'no errors');
  }
  if (mode === 'feed') {
    const p = await open(b, 1440, 900, 1);
    await p.evaluate(() => window.__koiPond.step(4));
    await p.evaluate(() => window.__koiPond.feed(1050, 420));
    for (const [s, tag] of [[0.3, '0.3'], [0.9, '1.2'], [1.3, '2.5'], [2.5, '5']]) {
      await p.evaluate(s => window.__koiPond.step(s), s);
      await p.screenshot({ path: OUT + `feed-${tag}.png` });
    }
    await p.screenshot({ path: OUT + 'feed-crop.png', clip: { x: 800, y: 200, width: 500, height: 440 } });
    console.log(JSON.stringify(await p.evaluate(() => window.__koiPond.stats)));
  }
  if (mode === 'reduce') {
    const p = await open(b, 1440, 900, 1, true);
    await p.screenshot({ path: OUT + 'reduced-d.png' });
    const p2 = await open(b, 390, 844, 2, true);
    await p2.screenshot({ path: OUT + 'reduced-p.png' });
    console.log(p._logs.join('|') || 'no errors');
  }
  if (mode === 'z3') {
    const p = await open(b, 600, 500, 3);
    await p.evaluate(() => window.__koiPond.step(9));
    await p.screenshot({ path: OUT + 'z3-full.png' });
    console.log(JSON.stringify(await p.evaluate(() => [window.__koiPond.debugFish(), window.__koiPond.stats])));
  }
  await b.close();
})();
