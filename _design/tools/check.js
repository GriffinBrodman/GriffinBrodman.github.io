const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const O='arcane/shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--proxy-server=https='+process.env.HTTPS_PROXY.replace(/^https?:\/\//,'')] });
  // reduced motion
  let c = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', permissions:['clipboard-read','clipboard-write'] });
  let p = await c.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8731/'); await p.waitForTimeout(300);
  await p.screenshot({ path: O+'reduce-t300.png' });
  // keyboard focus
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  await p.screenshot({ path: O+'focus.png' });
  await p.focus('#mail-btn'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const src = await (await fetch('http://127.0.0.1:8731/')).text();
  console.log('plain address in source:', src.includes('griffinbrodman@gmail.com'), src.includes('mailto:'));
  console.log('focused:', await p.evaluate(()=>document.activeElement.id), 'href:', await p.getAttribute('#mail-link','href'));
  await p.click('#mail-copy'); await p.waitForTimeout(200);
  console.log('copy label:', await p.textContent('#mail-copy'), 'clip:', await p.evaluate(()=>navigator.clipboard.readText()));
  // touch target sizes
  console.log(await p.evaluate(()=>[...document.querySelectorAll('a,button,textarea')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return r.height<44?(e.className||e.tagName)+e.textContent.slice(0,20)+':'+Math.round(r.height):null}).filter(Boolean).join(', ')||'all targets >=44'));
  console.log('errors', errs);
  // 404 confess
  p = await c.newPage(); await p.goto('http://127.0.0.1:8731/404.html');
  await p.fill('#sins','I used tabs.'); await p.click('button[type=submit]'); await p.waitForTimeout(300);
  await p.screenshot({ path: O+'404-confessed.png' });
  await b.close();
})();
