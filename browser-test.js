/* Headless Chrome smoke test: PUPPETEER=/path/to/puppeteer-core node browser-test.js http://localhost:8777/ shot.png */
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const URL = process.argv[2] || 'http://localhost:8777/'; const SHOT = process.argv[3];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.createBrowserContext(); const pg = await ctx.newPage();
  await pg.emulateTimezone('Australia/Perth');
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [], bad = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  pg.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  pg.on('dialog', d => d.accept());
  await ctx.overridePermissions(new globalThis.URL(URL).origin, ['geolocation']);
  await pg.setGeolocation({ latitude: -31.9523, longitude: 116.0812, accuracy: 6 });
  await pg.goto(URL, { waitUntil: 'networkidle0' });
  await pg.evaluate(() => navigator.serviceWorker.ready);
  const W = ms => new Promise(r => setTimeout(r, ms));
  const click = async s => { await pg.waitForSelector(s); await pg.click(s); await W(250); };
  const at = async (dy, dx) => { await pg.setGeolocation({ latitude: -31.9523 + dy, longitude: 116.0812 + dx, accuracy: 6 }); };
  await click('a[href="#edit/new"]'); await W(600);
  await pg.type('[name=name]', 'Wandoo Creek reserve'); await pg.type('[name=observer]', 'Landcare group');
  await pg.select('[name=method]', 'area'); await click('[data-a="1"]');
  const waAuto = await pg.$eval('[name=wa]', e => e.checked); if (!waAuto) await click('[name=wa]');
  await pg.evaluate(() => document.querySelector('details').open = true);
  for (const [k, v] of [['canopy', '2'], ['under', '1'], ['weeds', '1'], ['logs', '2'], ['bigtrees', '1']]) await pg.select('[name=c_' + k + ']', v);
  await click('button[type=submit]');
  await click('#bWalk'); await W(800);
  // habitat tree
  await at(0.0002, 0.0001); await click('a[href$="/tree"]'); await W(1200);
  await pg.type('[name=species]', 'Marri'); await pg.type('#dbhIn', '170');
  await click('[data-p=hs]'); await click('[data-p=hs]'); await click('[data-p=hm]'); await click('[data-p=hl]');
  const dbhTxt = await pg.$eval('#dbhOut', e => e.textContent); const cky = await pg.$eval('#cky', e => e.textContent);
  if (SHOT) { await pg.evaluate(() => scrollTo(0, 260)); await pg.screenshot({ path: SHOT.replace('.png', '-tree.png') }); }
  await click('#bPhoto'); await W(1500); await click('#snap'); await W(1500);
  const thumbs = await pg.$$eval('#th img', e => e.length);
  await click('button[type=submit]'); await W(300);
  // wandoo 32 cm
  await at(0.0005, 0.0004); await click('a[href$="/tree"]'); await W(1000);
  await pg.type('[name=species]', 'Wandoo'); await click('input[name=dbhMode][value=diam]+span'); await pg.type('#dbhIn', '32'); await click('input[name=group][value=sgw]+span');
  const cky2 = await pg.$eval('#cky', e => e.textContent); await click('input[name=status][value=dead]+span'); await click('button[type=submit]');
  // sighting
  await at(0.0008, 0.0006); await click('a[href$="/sighting"]'); await W(1000);
  await pg.type('[name=common]', "Carnaby's Cockatoo"); await pg.type('[name=sci]', 'Zanda latirostris'); await click('[data-p=count]'); await pg.select('[name=behaviour]', 'feeding');
  await click('[name=sensitive]'); await click('button[type=submit]');
  // sign, log, nest, threat
  await at(0.0010, 0.0002); await click('a[href$="/sign"]'); await W(900); await pg.select('[name=kind]', 'digging'); await pg.type('[name=common]', 'Quenda'); await click('button[type=submit]');
  await at(0.0006, -0.0002); await click('a[href$="/log"]'); await W(900); await pg.type('[name=diam]', '30'); await pg.type('[name=len]', '6'); await click('[name=hollow]'); await click('button[type=submit]');
  await at(0.0003, -0.0004); await click('a[href$="/threat"]'); await W(900); await pg.select('[name=kind]', 'weeds'); await pg.type('[name=notes]', '=Veldt grass, +patchy'); await click('button[type=submit]');
  await W(400);
  if (SHOT) { await W(2700); await pg.evaluate(() => scrollTo(0, 0)); await pg.screenshot({ path: SHOT }); }
  await click('#bWalk');
  const items = await pg.$$eval('.rec b', e => e.map(x => x.textContent));
  const sid = location => location; const hash = await pg.evaluate(() => location.hash);
  await click('a[href^="#sum/"]'); await W(500);
  const sumTbl = await pg.$$eval('.lt td', e => e.map(x => x.textContent));
  const species = await pg.$$eval('.card li b', e => e.map(x => x.textContent));
  const mapInk = await pg.$eval('#map', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] > 100 && d[i + 2] < 100) n++; return n; });
  if (SHOT) { await pg.evaluate(() => scrollTo(0, 99999)); await W(2700); await pg.screenshot({ path: SHOT.replace('.png', '-summary.png') }); }
  await click('#bShare'); const share = await pg.$eval('#sumTxt', e => e.value); await click('[data-close]');
  const ex = await pg.evaluate(() => {
    const L = STRINGS.en, D = HSApp.DB;
    return { dwc: HS.toCSV(HS.DWC_COLS, HS.dwcRows(D, { step: 0.01, scope: 'sensitive' }, L)).split('\r\n'), gen: HS.toCSV(HS.GEN_COLS, HS.generalRows(D, {}, L)).split('\r\n').length };
  });
  await click('#bExp'); const expBtns = await pg.$$eval('#sheet button', e => e.length); await click('[data-close]');
  await pg.setOfflineMode(true); await pg.goto(URL + hash, { waitUntil: 'load' }); await W(800);
  const off = await pg.$$eval('.rec b', e => e.length);
  await pg.goto(URL + '#about', { waitUntil: 'load' }); await W(400); const aboutOk = await pg.$eval('main', e => e.textContent.includes('500 mm') && e.textContent.includes('John Richards'));
  await pg.setOfflineMode(false);
  console.log(JSON.stringify({ errs, bad, waAuto, dbhTxt, cky, cky2, thumbs, items, sumTbl, species, mapInk, share, dwc: ex.dwc, genLines: ex.gen, expBtns, offlineRecords: off, aboutOk }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
