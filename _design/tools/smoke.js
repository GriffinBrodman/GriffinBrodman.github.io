const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  for (const u of ['test/', 'test/arcane/', 'test/arcane/404.html', 'test/koi/', 'test/koi/404.html']) {
    const errs = [];
    p.removeAllListeners('pageerror'); p.removeAllListeners('requestfailed'); p.removeAllListeners('response');
    p.on('pageerror', e => errs.push('JS: ' + e.message));
    p.on('response', r => { if (r.status() >= 400 && !/headshot|mini-\d|fonts/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
    await p.goto('http://localhost:8799/' + u, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    console.log(u, '=>', await p.title(), errs.length ? errs : 'OK');
  }
  await p.goto('http://localhost:8799/test/'); await p.screenshot({ path: process.argv[2] });
  await b.close();
})();
