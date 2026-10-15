// End-to-end checks against a running GLOBA instance (npm run build && npm start, or npm run dev).
//   E2E_URL=http://localhost:8788 node scripts/e2e.mjs
// Uses the Chromium that Playwright provides and software WebGL (SwiftShader) so it runs headless anywhere.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.E2E_URL ?? 'http://localhost:8788';
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const ONLY = process.env.E2E_ONLY?.split(',') ?? null; // e.g. E2E_ONLY=nowebgl,mobile
const want = (n) => !ONLY || ONLY.includes(n);
const results = [];
const consoleErrors = [];
let failures = 0;

async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push(['PASS', name, Date.now() - t]); console.log(`  ✓ ${name}`); }
  catch (e) { failures++; results.push(['FAIL', name, Date.now() - t, e.message]); console.log(`  ✗ ${name}\n      ${e.message.split('\n').slice(0, 4).join('\n      ')}`); }
}
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('globa:v1') ?? '{}').state ?? {});

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });

async function newPage(opts = {}, skipIntro = true) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  await page.addInitScript(() => { try { localStorage.setItem('globa:e2e', '1'); } catch { /* ignore */ } });
  if (skipIntro) await page.addInitScript(() => { try { sessionStorage.setItem('globa:intro-shown', '1'); } catch { /* ignore */ } });
  return { ctx, page };
}

console.log(`\nGLOBA e2e → ${BASE}\n`);

/* ---------------------------------------------------------------- desktop */
if (want('desktop')) {
  const { ctx, page } = await newPage({}, false);
  console.log('Intro & navigation');
  await step('first visit shows the branded intro with an Enter action', async () => {
    await page.goto(BASE); await page.waitForSelector('.intro');
    await page.waitForSelector('text=Enter your world', { state: 'visible' });
    ok(await page.locator('.intro-skip').isVisible(), 'skip button missing');
    await page.click('text=Enter your world');
    await page.waitForSelector('.intro', { state: 'detached' });
  });
  await step('every main route renders without crashing', async () => {
    for (const [path, text] of [['/', 'Layers'], ['/discover', 'Where could we live next?'], ['/saved', 'Nothing saved yet'], ['/itineraries', 'No itineraries yet'], ['/our-world', 'Achievements'], ['/settings', 'Make it ours'], ['/place/lisbon', 'Main reason to visit']]) {
      await page.goto(BASE + path); await page.waitForSelector(`text=${text}`, { timeout: 15000 });
    }
  });
  await step('unknown routes recover', async () => { await page.goto(BASE + '/definitely/not/here'); await page.waitForSelector('text=Layers'); });
  await step('unknown place shows a helpful empty state', async () => { await page.goto(BASE + '/place/nope'); await page.waitForSelector('text=couldn’t find that place'); });

  console.log('\nGlobe, map, search');
  await page.goto(BASE + '/');
  await step('3D globe canvas mounts (WebGL)', async () => { await page.waitForSelector('[data-testid=globe] canvas', { timeout: 20000 }); });
  await step('search → select a place opens its panel', async () => {
    await page.fill('input[type=search]', 'Cape Town'); await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForSelector('aside.hud-panel h2:has-text("Cape Town")');
  });
  await step('globe → map keeps the selected place; map → globe returns', async () => {
    await page.click('.viewseg button:has-text("Map")');
    await page.waitForSelector('[data-testid=map] .leaflet-marker-icon', { state: 'attached', timeout: 15000 });
    ok(await page.locator('aside.hud-panel h2:has-text("Cape Town")').isVisible(), 'selection lost after switching to map');
    ok(await page.locator('.leaflet-gmark .gmark.sel').count() > 0, 'selected marker not highlighted on the map');
    await page.click('.viewseg button:has-text("Globe")');
    await page.waitForTimeout(1800);
    ok(await page.locator('aside.hud-panel h2:has-text("Cape Town")').isVisible(), 'selection lost after returning to globe');
  });
  await step('natural-language search returns up to five explained matches', async () => {
    await page.goto(BASE + '/discover');
    await page.fill('input[type=search]', 'Find a quiet mountain town where we could live for three months'); await page.keyboard.press('Enter');
    await page.waitForSelector('.pcard', { timeout: 15000 });
    const n = await page.locator('section:has(h2:has-text("Top matches")) .pcard').count();
    ok(n >= 1 && n <= 5, `expected 1–5 top matches, got ${n}`);
    ok((await page.locator('.pcard .reasons li').count()) > 0, 'matches have no explanations');
    ok(await page.locator('text=Demo mode').first().isVisible(), 'demo mode not disclosed');
  });
  await step('filters combine, show chips and reset', async () => {
    await page.click('button:has-text("Reset all")');
    await page.click('button.fsec-head:has-text("Natural environment")').catch(() => {});
    await page.click('button.chip:has-text("Glaciers")'); await page.click('button.chip:has-text("One month")');
    await page.waitForSelector('[aria-label="Active filters"] >> text=Glaciers');
    ok(await page.locator('.pcard').count() > 0, 'no results for glaciers + month');
    await page.click('button:has-text("Reset filters")');
    ok(await page.locator('[aria-label="Active filters"]').count() === 0, 'chips not cleared');
  });

  console.log('\nSaved places & persistence');
  await page.goto(BASE + '/place/hermanus');
  await step('save from a brief → persisted in localStorage', async () => {
    await page.click('.brief .btn.primary:has-text("Save")'); await page.waitForSelector('text=Saved Hermanus');
    ok((await state(page)).saved?.hermanus?.status === 'saved', 'not persisted');
  });
  await step('saved place survives a reload', async () => { await page.reload(); await page.waitForSelector('button[aria-pressed=true]:has-text("Saved")'); });
  await step('Saved page: status, notes, tags persist', async () => {
    await page.goto(BASE + '/saved');
    await page.selectOption('select[aria-label^="Status of"]', 'planned');
    await page.click('button:has-text("Add notes")'); await page.fill('textarea', 'Whales in August');
    await page.fill('input[aria-label^="Add tag"]', 'whales'); await page.keyboard.press('Enter');
    await page.reload(); await page.waitForSelector('.saved-card');
    const s = (await state(page)).saved.hermanus;
    ok(s.status === 'planned' && s.notes === 'Whales in August' && s.tags.includes('whales'), `bad state ${JSON.stringify(s)}`);
  });
  await step('removing offers undo and undo restores notes', async () => {
    await page.click('button[aria-label^="Remove Hermanus"]'); await page.waitForSelector('text=Nothing saved yet');
    await page.click('.toast button:has-text("Undo")'); await page.waitForSelector('.saved-card');
    ok((await state(page)).saved.hermanus.notes === 'Whales in August', 'notes lost on undo');
  });

  console.log('\nDestination brief');
  await step('brief has every required section', async () => {
    await page.goto(BASE + '/place/queenstown');
    for (const h of ['Main reason to visit', 'What makes it special', 'Extraordinary nearby places', 'Living like a local', 'Long-stay suitability', 'Pros and cons', 'Best time to visit', 'Accommodation', 'Practical summary', 'Suggest More', 'Sources & confidence']) await page.waitForSelector(`h2:has-text("${h}")`);
    ok(await page.locator('text=Not live-verified').count() > 0, 'curated disclaimer missing');
    ok(await page.locator('.season li').count() === 12, 'season strip missing');
  });
  await step('accommodation never shows invented listings', async () => {
    ok(await page.locator('text=No live listings provider is connected').isVisible(), 'missing honesty notice');
    ok(await page.locator('a:has-text("Airbnb search")').count() > 0, 'search links missing');
  });
  await step('Suggest More: category chips, live lookup or honest failure', async () => {
    await page.click('button.chip:has-text("Hidden gems")'); await page.click('button:has-text("Suggest")');
    await page.waitForSelector('.sm-result, .notice.error, .empty', { timeout: 40000 });
    ok(await page.locator('.sm-result').count() <= 5, 'more than five results');
  });

  console.log('\nItineraries');
  let tripUrl = '';
  await step('guided flow creates a persisted itinerary', async () => {
    await page.goto(BASE + '/itineraries/new');
    await page.click('button:has-text("Adventure")'); await page.click('button:has-text("Next")');
    await page.click('button:has-text("Add a place")'); await page.click('dialog .nearby-row >> nth=0'); await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")'); await page.click('button:has-text("One week")'); await page.click('button:has-text("Next")');
    await page.click('button:has-text("Nature & hiking")'); await page.click('button:has-text("Next")'); await page.click('button:has-text("Skip")'); await page.click('button:has-text("Next")');
    await page.click('button:has-text("Create itinerary")'); await page.waitForURL(/\/itineraries\/trip_/, { timeout: 20000 });
    tripUrl = page.url();
    const st = await state(page); ok(st.itineraries.length === 1 && st.itineraries[0].days.length === 7, `bad trip ${st.itineraries?.[0]?.days?.length}`);
  });
  await step('edit name, add a stop, reorder with buttons, move between days', async () => {
    await page.fill('input[aria-label="Itinerary name"]', 'Our test trip');
    await page.click('section[aria-label="Day 1"] button:has-text("Meal")');
    const day1 = page.locator('section[aria-label="Day 1"] .stop');
    const before = await day1.locator('input[aria-label="Stop title"]').evaluateAll((els) => els.map((e) => e.value));
    const last = before.length - 1;
    await day1.nth(last).locator('button[aria-label^="Move"][aria-label$="up"]').click();
    const after = await page.locator('section[aria-label="Day 1"] .stop input[aria-label="Stop title"]').evaluateAll((els) => els.map((e) => e.value));
    ok(after[last - 1] === before[last] && after[last] === before[last - 1], `reorder failed ${before} → ${after}`);
    await day1.nth(0).locator('button[aria-label^="Details for"]').click();
    const nStops = (await state(page)).itineraries[0].days[1].stops.length;
    await page.selectOption('section[aria-label="Day 1"] .stop >> nth=0 >> select >> nth=0', { index: 1 });
    ok((await state(page)).itineraries[0].days[1].stops.length === nStops + 1, 'move to another day failed');
    ok((await state(page)).itineraries[0].name === 'Our test trip', 'name not saved');
  });
  await step('regenerate a day, add a stay, set tentative/committed', async () => {
    await page.click('section[aria-label="Day 2"] button:has-text("Regenerate")');
    await page.click('role=tab[name=/Stays/]'); await page.click('button:has-text("Committed")');
    ok((await state(page)).itineraries[0].stays[0].committed === true, 'stay commit not saved');
  });
  await step('itinerary persists across reload, duplicates and deletes with undo', async () => {
    await page.reload(); await page.waitForSelector('input[aria-label="Itinerary name"]');
    ok(await page.inputValue('input[aria-label="Itinerary name"]') === 'Our test trip', 'lost after reload');
    await page.click('button:has-text("Duplicate")'); await page.waitForURL(/trip_/);
    await page.goto(BASE + '/itineraries'); await page.waitForFunction(() => document.querySelectorAll('.trip-card').length === 2, null, { timeout: 15000 }).catch(() => { throw new Error('duplicate missing'); });
    await page.click('.trip-card >> nth=0 >> button:has-text("Delete")'); await page.click('dialog[open] button:has-text("Delete")');
    await page.waitForFunction(() => document.querySelectorAll('.trip-card').length === 1, null, { timeout: 8000 }).catch(() => { throw new Error('delete failed'); });
    await page.click('.toast button:has-text("Undo")'); await page.waitForFunction(() => document.querySelectorAll('.trip-card').length === 2, null, { timeout: 8000 }).catch(() => { throw new Error('undo failed'); });
  });

  console.log('\nMiniature world');
  await step('Light It Up: walk to the bulb, activate, celebrate, return, globe lights up', async () => {
    await page.goto(BASE + '/place/cape-town'); await page.click('.brief .btn.gold');
    await page.waitForURL(/\/light\/cape-town/); await page.waitForSelector('.game-holder canvas', { timeout: 30000 });
    await page.waitForSelector('text=Walk to the glowing light bulb');
    await page.evaluate(() => window.__globaGame?.advance(2.2)); // finish the camera intro (software GL renders slowly)
    const p0 = await page.evaluate(() => window.__globaGame?.playerPosition());
    ok(!!p0, 'game test hook missing');
    await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
    const p1 = await page.evaluate(() => window.__globaGame.playerPosition());
    ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.2, 'WASD did not move the character');
    await page.evaluate(() => window.__globaGame.teleportToBulb());
    await page.waitForSelector('text=You’re close', { timeout: 15000 });
    await page.click('[data-testid=interact]', { force: true }); // the button pulses, which Playwright would otherwise wait out
    await page.waitForSelector('text=Let there be light');
    await page.evaluate(() => window.__globaGame.advance(5.5));
    await page.waitForSelector('.celebrate-card', { timeout: 15000 });
    ok(await page.locator('text=isn’t marked visited').isVisible(), 'visited disclaimer missing');
    await page.evaluate(() => window.__globaGame.advance(3));
    await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 });
    const st = await state(page);
    ok(st.activations.some((a) => a.placeId === 'cape-town'), 'activation not recorded');
    ok(st.saved['cape-town'].status !== 'visited', 'activation wrongly marked the place visited');
    ok(!!st.achievements['first-light'], 'First Light not unlocked');
    await page.waitForSelector('.gmark.activated', { timeout: 20000 });
  });
  await step('game exit (Esc) leaves without activating', async () => {
    await page.goto(BASE + '/place/kyoto'); await page.click('.brief .btn.gold'); await page.waitForSelector('.game-holder canvas', { timeout: 30000 });
    await page.keyboard.press('Escape'); await page.waitForURL(/\/place\/kyoto/);
    ok(!(await state(page)).activations.some((a) => a.placeId === 'kyoto'), 'exit activated the place');
  });

  console.log('\nOur World, settings, assistant');
  await step('Our World reflects real data and achievements', async () => {
    await page.goto(BASE + '/our-world'); await page.waitForSelector('text=First Light');
    const earned = await page.locator('.ach.earned').count(); ok(earned >= 2, `expected earned achievements, got ${earned}`);
    ok(await page.locator('.stat:has(b:text-is("Lit up")) .stat-n').innerText() === '1', 'lit count wrong');
  });
  await step('settings: theme, currency, backup export/import, integrations disclosed', async () => {
    await page.goto(BASE + '/settings'); await page.click('.seg button:has-text("Dark")');
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'theme not applied');
    await page.selectOption('select >> nth=3', { label: 'EUR' }).catch(() => {});
    await page.waitForSelector('.integration:has-text("AI model")');
    ok(await page.locator('.integration:has-text("Accommodation") .badge:has-text("Live")').count() === 0, 'accommodation falsely live');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export backup")')]);
    ok(dl.suggestedFilename().startsWith('globa-backup'), 'bad backup name');
  });
  await step('assistant answers in demo mode and labels it', async () => {
    await page.click('nav.rail button[aria-label="Open travel assistant"]');
    await page.fill('input[aria-label="Message the assistant"]', 'Compare Lisbon and Chiang Mai for remote work'); await page.keyboard.press('Enter');
    await page.waitForSelector('.msg.assistant .badge:has-text("Demo answer")'); ok(await page.locator('.msg.assistant:has-text("Internet")').count() > 0, 'no comparison');
  });
  await step('keyboard: focus ring visible and skip link works', async () => {
    await page.goto(BASE + '/saved'); await page.waitForSelector('h1:has-text("Our collection")'); await page.keyboard.press('Tab');
    const txt = await page.evaluate(() => document.activeElement?.textContent);
    ok(/Skip to content/.test(txt ?? ''), `first tab stop was "${txt}"`);
  });
  await ctx.close();
}

/* ---------------------------------------------------------------- mobile */
if (want('mobile')) {
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  console.log('\nMobile (390×844, touch)');
  await step('bottom tab bar replaces the rail, no horizontal scroll', async () => {
    await page.goto(BASE + '/'); await page.waitForSelector('nav.tabbar');
    ok(!(await page.locator('nav.rail').isVisible()), 'rail visible on mobile');
    for (const path of ['/', '/discover', '/saved', '/itineraries', '/our-world', '/settings', '/place/lisbon']) {
      await page.goto(BASE + path); await page.waitForTimeout(700);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 1, `horizontal overflow ${over}px on ${path}`);
    }
  });
  await step('tapping a place opens a bottom sheet', async () => {
    await page.goto(BASE + '/'); await page.fill('input[type=search]', 'Lisbon'); await page.waitForTimeout(400); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.waitForSelector('aside.hud-panel'); const box = await page.locator('aside.hud-panel').boundingBox();
    ok(box.y > 300 && box.width > 340, `panel is not a bottom sheet: ${JSON.stringify(box)}`);
  });
  await step('mobile game: joystick moves the character, interact button activates', async () => {
    await page.goto(BASE + '/place/lisbon'); await page.click('.brief .btn.primary:has-text("Save")'); await page.click('.brief .btn.gold');
    await page.waitForSelector('.joystick', { timeout: 30000 }); await page.waitForSelector('.game-holder canvas');
    await page.evaluate(() => window.__globaGame.advance(2.2));
    const p0 = await page.evaluate(() => window.__globaGame.playerPosition());
    const box = await page.locator('.joystick').boundingBox(); const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 10 * i }] });
    await page.waitForTimeout(2500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const p1 = await page.evaluate(() => window.__globaGame.playerPosition());
    ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.2, 'joystick did not move the character');
    await page.evaluate(() => window.__globaGame.teleportToBulb()); await page.waitForSelector('text=You’re close');
    const b = await page.locator('[data-testid=interact]').boundingBox(); ok(b.width >= 100 && b.height >= 60, 'interact button too small');
    await page.tap('[data-testid=interact]'); await page.waitForSelector('text=Let there be light');
    await page.evaluate(() => window.__globaGame.advance(9)); await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 });
    ok((await state(page)).activations.some((a) => a.placeId === 'lisbon'), 'mobile activation not recorded');
  });
  await ctx.close();
}

/* ------------------------------------------------------- reduced motion, no WebGL */
if (want('motion')) {
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  console.log('\nReduced motion');
  await step('prefers-reduced-motion is honoured by the app', async () => {
    await page.goto(BASE + '/'); await page.waitForSelector('text=Layers');
    ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'emulation failed');
    const d = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur-3').trim());
    ok(/^0(ms|s)$/.test(d), `motion tokens not zeroed (${d})`);
  });
  await ctx.close();
}
if (want('nowebgl')) {
  const nb = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await nb.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('globa:e2e', '1'); sessionStorage.setItem('globa:intro-shown', '1'); } catch { /* */ } const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return orig.call(this, t, ...a); }; });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror(nowebgl): ${e.message.slice(0, 160)}`));
  console.log('\nWebGL unavailable');
  await step('Explore falls back to a 2D globe and the map still works', async () => {
    await page.goto(BASE + '/'); await page.waitForSelector('.fallback-note'); await page.click('.viewseg button:has-text("Map")'); await page.waitForSelector('[data-testid=map] .leaflet-marker-icon', { state: 'attached' });
  });
  await step('Light It Up degrades to a 2D activation that still records', async () => {
    await page.goto(BASE + '/place/bled'); await page.click('.brief .btn.gold'); await page.waitForSelector('text=can’t load here');
    await page.click('button:has-text("Light it up anyway")'); await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 });
    const st = await state(page); ok(st.activations.some((a) => a.placeId === 'bled'), 'fallback activation not recorded');
  });
  await nb.close();
}

await browser.close();
console.log(`\n${results.length - failures}/${results.length} checks passed`);
const real = consoleErrors.filter((e) => !/Failed to load|Fullscreen|favicon/.test(e));
if (real.length) { console.log(`\nConsole/page errors (${real.length}):`); [...new Set(real)].forEach((e) => console.log('  -', e)); }
process.exit(failures || real.length ? 1 : 0);
