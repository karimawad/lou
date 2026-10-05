// Drives Lou like a user and screenshots each step. Usage: node scripts/walkthrough.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5179/';
const YEAR = Number(process.env.YEAR ?? 2025);
const OUT = resolve('../research/render_check/ui' + (process.env.YEAR ? '-' + process.env.YEAR : ''));
const FIX = resolve('src/extract/__fixtures__');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const requests = [];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['blob:', 'data:'].includes(u.protocol) && u.host !== new URL(BASE).host) requests.push(`${name}: ${r.url()}`); });
  const shot = (step) => page.screenshot({ path: `${OUT}/${name}-${step}.png`, fullPage: true });

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot('1-start');
  await page.getByRole('radio', { name: new RegExp('^' + (process.env.YEAR ?? '2025')) }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByLabel('First name and middle initial').fill('Sam');
  await page.getByLabel('Last name', { exact: true }).fill('Lee');
  await page.getByLabel('Social Security number').fill('123456789');
  await page.getByLabel('Date of birth').fill('1985-05-01');
  await page.getByLabel('Occupation').fill('Engineer');
  await page.getByRole('group', { name: /married on December 31/ }).getByLabel('No').check();
  await page.getByRole('radio', { name: /^Single/ }).check();
  await page.getByLabel('Street address').fill('1 King St W');
  await page.getByLabel('City').fill('Toronto');
  await page.getByLabel('Province or territory').selectOption('ON');
  await page.getByLabel('Postal code').fill('M5H 1A1');
  await page.getByRole('group', { name: /live in Canada for all/ }).getByLabel('Yes').check();
  await page.getByRole('group', { name: /digital assets/ }).getByLabel('No').check();
  await shot('2-you');
  await page.getByRole('button', { name: 'Continue' }).click();

  await shot('3-slips-empty');
  // Slips printed with another year go to that year's workspace, so upload only slips for the year being filed.
  const files = { 2025: ['t4-2025-fillable.pdf', 't5-2025-flat.pdf'], 2024: ['t4-2024-fillable.pdf'], 2023: [] }[YEAR];
  if (files.length) {
    await page.locator('main input[type=file]').first().setInputFiles(files.map((f) => `${FIX}/${f}`));
    await page.getByText('Found a slip').nth(files.length - 1).waitFor({ timeout: 60000 });
  }
  // NOA typed in
  await page.getByRole('button', { name: 'Type it in' }).click();
  await shot('3-slips-loaded');
  await page.getByRole('button', { name: 'Check the numbers', exact: true }).click();

  await page.waitForTimeout(800);
  await page.locator('.box-row').first().hover();
  await page.waitForTimeout(400);
  await shot('4-review-t4');
  for (let k = 0; k < files.length; k++) {
    await page.getByRole('button', { name: 'This slip looks right' }).click();
    await page.waitForTimeout(300);
  }
  // NOA
  await page.getByLabel(/Box 15000/).fill('103760');
  await page.getByLabel(/Box 23600/).fill('103760');
  await page.getByLabel(/Box 42000/).fill('13000');
  await page.getByLabel(/Box 42800/).fill('7000');
  await page.getByLabel(/Box 42800/).blur();
  await shot('4-review-noa');
  await page.getByRole('button', { name: 'This slip looks right' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  if (YEAR === 2025) await page.getByRole('radio', { name: /^Shares of companies/ }).check();
  await page.getByRole('button', { name: 'Add an account' }).click();
  await page.getByLabel('Institution', { exact: true }).fill('RBC Royal Bank');
  await page.getByLabel('Account number').fill('1234567');
  await page.getByLabel('Highest balance in the year (CAD)').fill('20000');
  await page.getByLabel(/Balance on Dec 31/).fill('18000');
  await page.getByLabel(/Balance on Dec 31/).blur();
  await page.getByLabel('Institution street address').fill('200 Bay St');
  if (files.length) await page.getByRole('group', { name: /Form 2555\) on a past/ }).getByLabel('No').check(); // asked only with wages
  await shot('5-questions');
  await page.getByRole('button', { name: 'See my US return' }).click();
  await page.waitForTimeout(500);
  await shot('6-results');

  const download = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'Download PDF' }).first().click();
  const d = await download;
  await d.saveAs(`${OUT}/${name}-return.pdf`);
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 });
await run('mobile', { width: 390, height: 844 });
await browser.close();
console.log('errors:', errors.length ? errors : 'none');
console.log('off-origin requests:', requests.length ? requests : 'none');
