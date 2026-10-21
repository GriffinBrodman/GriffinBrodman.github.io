const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--proxy-server=https='+process.env.HTTPS_PROXY.replace(/^https?:\/\//,'')] });
  const p = await (await b.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://127.0.0.1:8731/'); await p.waitForTimeout(2000);
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => [...document.querySelectorAll('[data-r]')].map(e => e.className + ':' + e.classList.contains('in') + ':' + getComputedStyle(e).opacity).join('\n')));
  await b.close();
})();
