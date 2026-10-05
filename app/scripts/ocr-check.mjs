// Uploads a photo and confirms on-device OCR runs (and the CSP doesn't block it).
// Usage: node scripts/ocr-check.mjs [baseUrl] [fixture file name]
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
const BASE = process.argv[2] ?? 'http://localhost:5180/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('lou:v1', JSON.stringify({ version: 1, step: 'slips', year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' }, slips: [], docs: [] })));
await page.reload();
const FIXTURE = process.argv[3] ?? 't4-2025-photo.jpg';
await page.locator('main input[type=file]').first().setInputFiles(resolve('src/extract/__fixtures__/' + FIXTURE));
await page.getByText(/Found a slip|No slip found|couldn't/).first().waitFor({ timeout: 120000 });
const status = await page.locator('.list-meta').first().textContent();
await page.waitForTimeout(1500); // let autosave write the state
await page.screenshot({ path: resolve('../research/render_check/ui/ocr-' + FIXTURE.replace(/\..*$/, '') + '.png'), fullPage: true });
const state = await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1') ?? '{}'));
console.log('status:', status, 'type:', state.slips?.[0]?.type, 'slips:', JSON.stringify((state.slips ?? []).map((s) => [s.type, s.year, Object.keys(s.reads ?? {}).length])), 'years:', JSON.stringify(Object.fromEntries(Object.entries(state.years ?? {}).map(([y, d]) => [y, (d.slips ?? []).map((s) => [s.type, Object.fromEntries(Object.entries(s.reads ?? {}).map(([k, v]) => [k, [v.value, v.confidence]]))])]))));
console.log('reads:', JSON.stringify(Object.fromEntries(Object.entries(state.slips?.[0]?.reads ?? {}).map(([k, v]) => [k, [v.value, v.raw, v.confidence]]))));
console.log('problems:', problems.length ? problems : 'none');
await browser.close();
