// usage: node shoot.js <url> <outprefix> [w h] [times comma] [extra: full|scroll|reduce|hover]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [url, out, w = '1440', h = '900', times = '500,2000,4000,8000', mode = ''] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--ignore-gpu-blocklist', '--proxy-server=https=' + (process.env.HTTPS_PROXY||'').replace(/^https?:\/\//,'')],
  });
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h }, deviceScaleFactor: +w < 800 ? 2 : 1,
    reducedMotion: mode.includes('reduce') ? 'reduce' : 'no-preference',
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => logs.push('reqfail: ' + r.url()));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  for (const t of times.split(',').map(Number)) {
    const wait = t - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}-t${t}.png` });
  }
  if (mode.includes('hover')) {
    await page.mouse.move(+w * 0.25, +h * 0.5);
    await page.hover('.links li:nth-child(2) .row');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}-hover.png` });
    await page.click('#mail-btn');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}-mail.png` });
  }
  if (mode.includes('scroll')) {
    const H = await page.evaluate(() => document.body.scrollHeight);
    let i = 0;
    for (let y = +h * 0.9; y < H; y += +h * 0.85) {
      await page.evaluate(y => window.scrollTo(0, y), y);
      await page.waitForTimeout(1300);
      await page.screenshot({ path: `${out}-s${i++}.png` });
    }
  }
  if (mode.includes('full')) {
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}-full.png`, fullPage: true });
  }
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.fonts.check('16px "Bree Serif"'), document.fonts.check('16px "Cormorant Garamond"')]);
  console.log('scrollWidth/innerWidth/bree/cormorant', sw.join(' '));
  console.log(logs.join('\n') || 'no console errors');
  await browser.close();
})();
