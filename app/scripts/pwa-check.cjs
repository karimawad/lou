// Checks the installable web app against the production build: offline storage, installability, reading slips
// and photos offline, auto-save to a folder (stood in by the browser's private file system), and the update prompt.
// Usage: npm run build, npx vite preview --port 5182, then node scripts/pwa-check.cjs [url]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:5182/app/';
const FIX = require('path').resolve('src/extract/__fixtures__');
const DIST = require('path').resolve('dist');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const offOrigin = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!['blob:', 'data:'].includes(u.protocol) && u.host !== new URL(BASE).host) offOrigin.push(r.url()); });

  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait until every file is stored.
  const cached = await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const keys = await caches.keys();
      if (keys.length) { const c = await caches.open(keys[0]); const n = (await c.keys()).length; if (n >= 70) return { cache: keys[0], files: n }; }
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  });
  console.log('cached:', JSON.stringify(cached));

  // Installability as Chrome judges it.
  const cdp = await ctx.newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest');
  const inst = await cdp.send('Page.getInstallabilityErrors');
  console.log('manifest errors:', manifest.errors.length ? manifest.errors : 'none', '| installability errors:', inst.installabilityErrors.length ? inst.installabilityErrors.map((e) => e.errorId) : 'none');

  // Offline: reload, read a fillable PDF and a photo (OCR) with no network at all.
  await ctx.setOffline(true);
  await page.reload();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  console.log('offline page title:', await page.title());
  await page.waitForTimeout(1500);
  console.log('offline h1:', await page.locator('h1').first().textContent().catch(() => 'none'));
  await page.getByRole('button', { name: 'Start 2025' }).click();
  await page.getByLabel('First name and middle initial').fill('Sam');
  await page.getByLabel('Last name', { exact: true }).fill('Lee');
  await page.getByLabel('Social Security number').fill('123456789');
  await page.getByLabel('Date of birth').fill('1985-05-01');
  await page.getByRole('group', { name: /married on December 31/ }).getByLabel('No').check();
  await page.getByRole('radio', { name: /^Single/ }).check();
  await page.getByLabel('City').fill('Toronto');
  await page.getByLabel('Province or territory').selectOption('ON');
  await page.getByRole('group', { name: /live in Canada for all/ }).getByLabel('Yes').check();
  await page.getByRole('group', { name: /digital assets/ }).getByLabel('No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('main input[type=file]').first().setInputFiles([`${FIX}/t4-2025-fillable.pdf`, `${FIX}/t4a-2025-photo.jpg`]);
  await page.getByText('Found a slip').nth(1).waitFor({ timeout: 120000 });
  const found = await page.locator('.list-title').allTextContents();
  console.log('read offline:', found.join(' | '));
  await page.getByRole('button', { name: 'Check the numbers', exact: true }).click();
  await page.waitForTimeout(600);
  console.log('T4 box 14 offline:', await page.locator('#box-14').inputValue());

  // Auto-save to a folder: stand in for the folder picker with the browser's private file system.
  await ctx.setOffline(false);
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      const dir = await navigator.storage.getDirectory();
      dir.queryPermission = async () => 'granted';
      dir.requestPermission = async () => 'granted';
      Object.defineProperty(dir, 'name', { value: 'Taxes' });
      return dir;
    };
  });
  await page.locator('.rail').getByRole('button', { name: 'Your data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Save automatically to a folder/ }).click();
  await page.waitForTimeout(500);
  const folderStatus = (await page.getByRole('dialog').locator('.folder-sync').innerText()).replace(/\s+/g, ' ');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByLabel('Payer').fill('Maple Co Ltd').catch(() => {});
  await page.waitForTimeout(4500);
  const files = await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const out = [];
    for await (const [name, h] of dir.entries()) { const f = await h.getFile(); out.push(`${name} (${Math.round(f.size / 1024)}KB, has Sam: ${(await f.text()).includes('"Sam"')})`); }
    return out;
  });
  console.log('folder files:', files.join(' | '));
  console.log('folder status:', folderStatus);

  // Update: change the worker's version on disk, check for updates, accept.
  const sw = fs.readFileSync(`${DIST}/sw.js`, 'utf8');
  fs.writeFileSync(`${DIST}/sw.js`, sw.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-next'"));
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.getByText('A new version of Lou is ready').waitFor({ timeout: 60000 });
  console.log('update banner shown');
  await Promise.all([page.waitForEvent('load', { timeout: 60000 }), page.getByRole('button', { name: 'Use the new version' }).click()]);
  console.log('after update, cache:', await page.evaluate(async () => (await caches.keys()).join(',')), '| slips kept:', await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1')).slips.length));
  fs.writeFileSync(`${DIST}/sw.js`, sw);

  console.log('errors:', errors.length ? errors : 'none');
  console.log('off-origin requests:', offOrigin.length ? offOrigin : 'none');
  await browser.close();
})();
