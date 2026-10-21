const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--proxy-server=https=' + (process.env.HTTPS_PROXY||'').replace(/^https?:\/\//,'')] });
  const ctx = await b.newContext({ ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto('file:///home/user/GriffinBrodman.github.io/resume/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  console.log('fonts:', await p.evaluate(() => ['Bree Serif','Inter'].map(f => f + '=' + document.fonts.check('12px "' + f + '"'))));
  const h = await p.evaluate(() => document.querySelector('.sheet').scrollHeight);
  console.log('sheet height px:', h, '(letter = 1056)');
  await p.pdf({ path: '/home/user/GriffinBrodman.github.io/resume/griffin-brodman-resume.pdf', format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await p.setViewportSize({ width: 900, height: 1150 });
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
})();
