// Captures the screenshots used in docs/GLOBA-Walkthrough. Run against a running instance:
//   E2E_URL=http://localhost:8788 node scripts/capture-docs.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const BASE = process.env.E2E_URL ?? 'http://localhost:8788';
const OUT = new URL('../docs/img/', import.meta.url).pathname;
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const init = () => { try { sessionStorage.setItem('globa:intro-shown', '1'); localStorage.setItem('globa:e2e', '1'); } catch { /* */ } };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(init);
const snap = async (name, p = page) => { await p.screenshot({ path: `${OUT}${name}.png` }); console.log('  •', name); };
const tryStep = async (name, fn) => { try { await fn(); } catch (e) { console.log('  ! skipped', name, '-', e.message.split('\n')[0]); } };
const w = (ms) => page.waitForTimeout(ms);
const go = async (path, ms = 2500) => { await page.goto(BASE + path); await w(ms); };

console.log('Intro');
await tryStep('intro', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage();
  await p.goto(BASE); await p.waitForSelector('text=Enter your world', { state: 'visible' }); await p.waitForTimeout(800); await snap('01-intro', p); await c.close();
});

console.log('Seeding data through the UI');
for (const id of ['cape-town', 'hermanus', 'lisbon', 'kyoto', 'queenstown', 'reykjavik', 'chamonix']) {
  await tryStep('save ' + id, async () => { await go('/place/' + id, 1800); await page.click('.brief .btn.primary:has-text("Save")'); await w(300); });
}
await tryStep('statuses', async () => {
  await go('/saved', 1500);
  const sel = page.locator('select[aria-label^="Status of"]');
  const cards = await page.locator('.saved-card').count();
  for (let i = 0; i < cards; i++) {
    const name = await page.locator('.saved-card h3').nth(i).innerText();
    if (name === 'Lisbon') await sel.nth(i).selectOption('planned');
    if (name === 'Kyoto') await sel.nth(i).selectOption('visited');
  }
  await page.click('button:has-text("Add notes") >> nth=0'); await page.fill('textarea >> nth=0', 'Sunrise at Table Mountain, then wine in Stellenbosch.');
  await page.fill('input[aria-label^="Add tag"] >> nth=0', 'work-friendly'); await page.keyboard.press('Enter');
});
for (const [id, theme] of [['cape-town', null], ['queenstown', null]]) {
  await tryStep('light ' + id, async () => {
    await go('/light/' + id, 800); await page.waitForSelector('.game-holder canvas', { timeout: 30000 }); await w(1200);
    await page.evaluate(() => window.__globaGame.advance(2.5)); await page.evaluate(() => window.__globaGame.teleportToBulb()); await w(600);
    await page.click('[data-testid=interact]', { force: true }); await page.evaluate(() => window.__globaGame.advance(9)); await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 }); await w(1500);
  });
}
await tryStep('itinerary', async () => {
  await go('/itineraries/new', 1200);
  await page.click('button:has-text("Long-stay living")'); await page.click('button:has-text("Next")');
  await page.click('button:has-text("Add a place")'); await page.fill('dialog input[type=search], dialog .searchinput', 'Lisbon'); await w(300); await page.click('dialog .nearby-row >> nth=0');
  await page.click('button:has-text("Add a place")'); await page.fill('dialog input[type=search], dialog .searchinput', 'Funchal'); await w(300); await page.click('dialog .nearby-row >> nth=0');
  await page.click('button:has-text("Next")'); await page.click('button:has-text("Next")'); await page.click('button:has-text("Three months")'); await page.click('button:has-text("Next")');
  await page.click('button:has-text("Focused work")'); await page.click('button:has-text("Next")'); await page.click('button:has-text("Next")'); await page.click('button:has-text("Next")');
  await snap('wizard-last');
  await page.click('button:has-text("Create itinerary")'); await page.waitForURL(/trip_/, { timeout: 25000 }); await w(2500);
});

console.log('Explore');
await go('/', 5000); await snap('02-explore-globe');
await tryStep('layers', async () => { await page.click('button:has-text("Layers")'); await w(300); await snap('03-layers'); await page.click('button:has-text("Layers")'); });
await tryStep('search suggestions', async () => { await page.fill('input[type=search]', 'Lisb'); await w(900); await snap('04-search-suggest'); });
await tryStep('place panel', async () => { await page.fill('input[type=search]', 'Queenstown'); await w(500); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await w(3800); await snap('05-place-panel'); });
await tryStep('map', async () => { await page.click('.viewseg button:has-text("Map")'); await w(4500); await snap('06-map-view'); await page.click('.viewseg button:has-text("Globe")'); await w(2500); });
await tryStep('nl results', async () => { await page.click('button[aria-label="Close panel"]').catch(() => {}); await page.fill('input[type=search]', 'Show me unusual natural landscapes near Cape Town'); await page.keyboard.press('Enter'); await w(4500); await snap('07-explore-results'); });
await tryStep('country', async () => { await go('/', 3500); const v = page.viewportSize(); await page.mouse.click(v.width / 2 - 20, v.height / 2 + 40); await w(2500); await snap('08-country-or-globe'); });
await tryStep('filters', async () => { await go('/', 3000); await page.click('button[aria-label="Open filters"]'); await w(700); await page.click('button.chip:has-text("Glaciers")').catch(() => {}); await page.click('button.chip:has-text("Three months")').catch(() => {}); await w(500); await snap('09-filters'); });
await tryStep('lit globe', async () => { await go('/?focus=cape-town&lit=1', 6500); await snap('10-lit-globe'); });

console.log('Discover');
await go('/discover', 3500); await snap('11-discover-home');
await tryStep('discover results', async () => { await page.fill('input[type=search]', 'Find a quiet mountain town where we could live for three months'); await page.keyboard.press('Enter'); await w(4500); await snap('12-discover-results'); });

console.log('Brief');
await go('/place/chamonix', 4500); await snap('13-brief-top');
for (const [id, name, y] of [['why', '14-brief-why', 0], ['nearby', '15-brief-nearby', 0], ['longstay', '16-brief-longstay', 0], ['time', '17-brief-time', 0], ['stay', '18-brief-accommodation', 0], ['summary', '19-brief-summary', 0]]) {
  await tryStep(name, async () => { await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id); await w(1200); await snap(name); });
}
await tryStep('suggest more', async () => {
  await page.evaluate(() => document.querySelector('#sm-title').scrollIntoView()); await w(400);
  await page.click('button.chip:has-text("Coffee shops")'); await page.click('button.chip:has-text("Hidden gems")'); await page.click('button:has-text("Suggest")'); await page.waitForSelector('.sm-result, .notice.error, .empty', { timeout: 40000 }); await w(800);
  await page.evaluate(() => document.querySelector('#sm-title').scrollIntoView()); await w(400); await snap('20-suggest-more');
});
await tryStep('sources', async () => { await page.evaluate(() => document.getElementById('sources')?.scrollIntoView()); await w(500); await snap('21-brief-sources'); });

console.log('Saved / Trips / World / Settings / Assistant');
await go('/saved', 3500); await snap('22-saved');
await go('/itineraries', 3000); await snap('23-itineraries');
await tryStep('trip', async () => { await page.click('.trip-card h3 a'); await w(3500); await snap('24-itinerary-days'); await page.evaluate(() => document.querySelector('.stop button[aria-label^="Details for"]')?.click()); await w(500); await snap('25-itinerary-stop-open'); await page.click('role=tab[name=/Stays/]'); await w(600); await snap('26-itinerary-stays'); });
await go('/our-world', 4500); await snap('27-our-world');
await tryStep('world bottom', async () => { await page.evaluate(() => document.querySelector('.page').scrollTo(0, 700)); await w(600); await snap('28-our-world-achievements'); });
await go('/settings', 2500); await snap('29-settings');
await tryStep('chars', async () => { await page.evaluate(() => document.getElementById('characters').scrollIntoView()); await w(600); await snap('30-settings-characters'); });
await tryStep('integrations', async () => { await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Integrations')?.scrollIntoView()); await w(800); await snap('31-settings-integrations'); });
await tryStep('assistant', async () => { await go('/place/lisbon', 2500); await page.click('nav.rail button[aria-label="Open travel assistant"]'); await page.fill('input[aria-label="Message the assistant"]', 'Compare Lisbon and Chiang Mai for remote work'); await page.keyboard.press('Enter'); await w(1500); await snap('32-assistant'); });

console.log('Miniature world');
await tryStep('game start', async () => {
  await go('/light/cape-town', 800); await page.waitForSelector('.game-holder canvas', { timeout: 30000 }); await w(1500); await page.evaluate(() => window.__globaGame.advance(2.6)); await w(900); await snap('33-game-start');
  await page.evaluate(() => window.__globaGame.teleportToBulb()); await w(900); await snap('34-game-near-bulb');
  await page.click('[data-testid=interact]', { force: true }); await page.evaluate(() => window.__globaGame.advance(1.4)); await w(900); await snap('35-game-lighting');
  await page.evaluate(() => window.__globaGame.advance(3.5)); await w(900); await snap('36-game-celebrate');
  await page.evaluate(() => window.__globaGame.advance(0.8)); await w(900); await snap('37-game-card');
});
const worlds = [['savanna', 'Africa'], ['asia', 'Asia'], ['europe', 'Europe'], ['northamerica', 'North America'], ['southamerica', 'South America'], ['oceania', 'Oceania'], ['antarctica', 'Antarctica'], ['desert', 'Desert'], ['rainforest', 'Rainforest'], ['lake', 'Lake'], ['alpine', 'Alpine'], ['coast', 'Coast'], ['volcano', 'Volcano']];
const wc = await browser.newContext({ viewport: { width: 960, height: 600 } }); const wp = await wc.newPage(); await wp.addInitScript(init);
await wp.goto(BASE + '/place/cape-town'); await wp.waitForTimeout(1500);
for (const [t] of worlds) {
  await tryStep('world ' + t, async () => {
    await wp.goto(`${BASE}/light/cape-town?theme=${t}`); await wp.waitForSelector('.game-holder canvas', { timeout: 30000 }); await wp.waitForTimeout(1200);
    await wp.evaluate(() => { window.__globaGame.advance(2.6); }); await wp.waitForTimeout(900);
    await wp.evaluate(() => document.querySelectorAll('.objective, .game-pill, .act-btn, .compass').forEach((e) => (e.style.display = 'none')));
    await snap('world-' + t, wp);
  });
}
await wc.close();

console.log('Phone');
const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const mp = await mc.newPage(); await mp.addInitScript(init);
await mp.goto(BASE + '/place/cape-town'); await mp.waitForTimeout(1500);
await tryStep('m explore', async () => { await mp.goto(BASE + '/'); await mp.waitForTimeout(4500); await snap('m-01-explore', mp); await mp.fill('input[type=search]', 'Queenstown'); await mp.waitForTimeout(500); await mp.keyboard.press('ArrowDown'); await mp.keyboard.press('Enter'); await mp.waitForTimeout(3800); await snap('m-02-sheet', mp); });
await tryStep('m discover', async () => { await mp.goto(BASE + '/discover'); await mp.waitForTimeout(2500); await snap('m-03-discover', mp); });
await tryStep('m brief', async () => { await mp.goto(BASE + '/place/chamonix'); await mp.waitForTimeout(3500); await snap('m-04-brief', mp); });
await tryStep('m saved', async () => { await mp.goto(BASE + '/saved'); await mp.waitForTimeout(2500); await snap('m-05-saved', mp); });
await tryStep('m world', async () => { await mp.goto(BASE + '/our-world'); await mp.waitForTimeout(3500); await snap('m-06-world', mp); });
await tryStep('m game', async () => { await mp.goto(BASE + '/light/queenstown'); await mp.waitForSelector('.joystick', { timeout: 30000 }); await mp.waitForTimeout(1200); await mp.evaluate(() => window.__globaGame.advance(2.6)); await mp.waitForTimeout(900); await snap('m-07-game', mp); });
await browser.close();
console.log('done');
