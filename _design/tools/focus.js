const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--proxy-server=https='+process.env.HTTPS_PROXY.replace(/^https?:\/\//,'')] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:8731/'); await p.waitForTimeout(3500);
  for (let i=0;i<3;i++){ await p.keyboard.press('Tab'); console.log(await p.evaluate(()=>document.activeElement.className+' '+document.activeElement.matches(':focus-visible'))); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'arcane/shots/focus.png', clip:{x:100,y:480,width:640,height:300} });
  await b.close();
})();
