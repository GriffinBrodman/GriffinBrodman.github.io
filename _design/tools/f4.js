const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:8766/?noadapt'); await p.waitForFunction(() => window.__koiPond); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__koiPond.setReducedMotion(true); window.__koiPond.step(4); window.__koiPond.feed(1050, 420); });
  for (let i = 0; i < 12; i++) {
    const r = await p.evaluate(() => { window.__koiPond.step(1); return [window.__koiPond.stats.pellets, window.__koiPond.debugFish().filter(f => f.feed >= 0).map(f => f.feed + '/' + f.mode).join(' ')]; });
    console.log(i + 1, JSON.stringify(r));
  }
  await p.screenshot({ path: '/tmp/claude-0/-home-user-GriffinBrodman-github-io/a4ce9ba0-dc29-5a50-8bdd-312aa76c5d90/scratchpad/hifi/koi/review-shots/r4/feed-12s.png', clip: { x: 750, y: 150, width: 600, height: 500 } });
  await b.close();
})();
