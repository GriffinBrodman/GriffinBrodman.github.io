const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:8763/?noadapt'); await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo({top: 1600, behavior: 'instant'}));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/claude-0/-home-user-GriffinBrodman-github-io/a4ce9ba0-dc29-5a50-8bdd-312aa76c5d90/scratchpad/hifi/koi/review-shots/d-scroll-instant.png' });
  console.log(await p.evaluate(() => { const c = document.querySelector('canvas.pond').getBoundingClientRect(); return [c.top, c.height, innerHeight, scrollY]; }));
  await b.close();
})();
