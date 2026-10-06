// Multi-year check: on 2025, drop a 2024 T4 and confirm it lands in 2024; switch years and back.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
const BASE = process.argv[2] ?? 'http://localhost:5179/app/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('lou:v1', JSON.stringify({ version: 1, step: 'slips', year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' }, slips: [], docs: [], years: {} })));
await page.reload();
await page.locator('main input[type=file]').first().setInputFiles([resolve('src/extract/__fixtures__/t4-2025-fillable.pdf'), resolve('src/extract/__fixtures__/t4-2024-fillable.pdf')]);
await page.getByText(/Added to your 2024 return/).waitFor({ timeout: 60000 });
const jobs = await page.locator('.list-meta').allTextContents();
const listed2025 = await page.locator('.slip-tag').count();
await page.screenshot({ path: resolve('../research/render_check/ui/multiyear-slips.png'), fullPage: true });
await page.getByRole('button', { name: /^2024/ }).click();
await page.waitForTimeout(300);
const s = await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1') ?? '{}'));
await page.getByRole('button', { name: /Your slips/ }).click().catch(() => {});
await page.screenshot({ path: resolve('../research/render_check/ui/multiyear-2024.png'), fullPage: true });
console.log('jobs:', jobs);
console.log('slip rows on 2025 page (incl. upload rows):', listed2025);
console.log('active year after switch:', s.year, '| 2024 slips:', JSON.stringify((s.slips ?? []).map((x) => [x.type, x.year, x.boxes['14']])), '| 2025 stashed slips:', JSON.stringify((s.years?.['2025']?.slips ?? []).map((x) => [x.type, x.year])));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
