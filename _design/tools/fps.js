const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--proxy-server=https='+process.env.HTTPS_PROXY.replace(/^https?:\/\//,'')] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:8731/'); await p.waitForTimeout(6000);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); (function f(){ n++; if (performance.now()-t0 < 3000) requestAnimationFrame(f); else r(n/3); })(); }));
  console.log('fps after intro @2x:', fps.toFixed(1));
  await b.close();
})();
