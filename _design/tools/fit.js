const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--proxy-server=https=' + (process.env.HTTPS_PROXY||'').replace(/^https?:\/\//,'')] });
  const p = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage();
  await p.goto('file:///home/user/GriffinBrodman.github.io/resume/_source/griffin-brodman-resume.html');
  // Preview only: stand-ins close to Myriad Pro Light / Proxima Nova metrics
  await p.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400&family=Montserrat:wght@400&display=swap' });
  await p.addStyleTag({ content: "h1,h2,h3{font-family:'Source Sans 3',sans-serif!important;font-weight:300!important} body,span p,span li p,.info li{font-family:'Montserrat',sans-serif!important}" });
  await p.evaluate(() => document.fonts.ready);
  const m = await p.evaluate(() => {
    const page = document.querySelector('.page').getBoundingClientRect();
    const span = document.querySelector('.page > span').getBoundingClientRect();
    const foot = document.querySelector('.footer').getBoundingClientRect();
    return { pageBottom: Math.round(page.bottom), contentBottom: Math.round(span.bottom), footerTop: Math.round(foot.top) };
  });
  console.log(m);
  await p.screenshot({ path: process.argv[2], clip: await p.evaluate(() => { const r = document.querySelector('.page').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.max(r.height, document.querySelector('.page > span').getBoundingClientRect().bottom - r.y + 20) }; }) });
  await b.close();
})();
