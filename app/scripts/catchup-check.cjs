// Catch-up filing in a real browser: seeds three ready years, walks the screening, FBAR years, statement and downloads.
// Needs a Lou key for 2023-2025 in server/secrets/test-key-2023-2025.txt (private, never committed) to reach the downloads.
// Usage: node scripts/catchup-check.cjs [url]   (dev server: npm run dev)
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:5179/app/';
const keyFile = path.join(__dirname, '../../server/secrets/test-key-2023-2025.txt');
const KEY = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';
const OUT = path.join(__dirname, '../../research/render_check/catchup');

const slip = (id, type, boxes) => ({ id, type, owner: 'taxpayer', payer: 'Maple Co', boxes, reads: {}, edited: [], confirmed: true });
const yearData = (step) => ({
  step, filingStatus: 'single', spouseIsUsPerson: null, livedInCanadaAllYear: true, digitalAssets: false, accountsOver10k: null, docs: [], dependents: [],
  slips: [slip('t4', 'T4', { '14': 90000 }), slip('noa', 'NOA', { '15000': 90000, '23600': 90000, '42000': 11000, '42800': 6000 })],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  carryover: { general: 0, passive: 0, vintages: [] }, feieFacts: { bonaFideResident: true, residenceStart: '', daysInUs: 0 }, feie2555: {},
  accounts: [{ id: 'a1', owner: 'taxpayer', kind: 'bank', institution: 'CIBC', street: '199 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5L 1A2', accountNumber: '111', maxValueCad: 20000, yearEndValueCad: 15000, opened: false, closed: false }],
  noAccounts: false, businesses: [], sales: [], pficFunds: [], capitalLossCarryover: null, carryFrom: null, carryDismissed: [],
});
const state = {
  version: 1, year: 2025, ...yearData('catchup'),
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01', occupation: 'Designer' },
  spouse: { firstName: '', lastName: '', ssn: '', dateOfBirth: '' },
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  years: { 2024: yearData('results'), 2023: yearData('results') }, licenses: KEY ? [KEY] : [],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate((s) => localStorage.setItem('lou:v1', JSON.stringify(s)), state);
  await page.reload();
  await page.getByRole('button', { name: /^(Continue catch-up filing|Catch up on missed years)/ }).click();
  await page.waitForSelector('h1:has-text("Catch up on missed")');
  console.log('years table:', (await page.locator('.ledger').first().innerText()).replace(/\s+/g, ' ').slice(0, 260));

  const answer = async (legend, yes) => {
    const g = page.getByRole('group', { name: legend, exact: false }).first();
    await g.getByText(yes ? 'Yes' : 'No', { exact: true }).click();
  };
  // Hard stop first: an examination.
  await answer('Has the IRS told you it is auditing', true);
  console.log('stop shown:', await page.getByText('Lou stops here: Under examination or investigation').isVisible());
  await answer('Has the IRS told you it is auditing', false);

  for (const q of ['Has the IRS or FinCEN written', 'Does any of your income', 'At any point, did you decide', 'Before you started this, did you know', 'Did a bank, accountant', 'In the last six years, did you file', 'In any of those years, did you keep a home']) await answer(q, false);
  await answer('Do you have a US Social Security number', true);
  for (const y of [2023, 2024, 2025]) { await answer(`Did you already file a US return for ${y}`, false); await page.getByLabel(`Days in the US in ${y}`).fill('12'); }
  const ext = page.getByRole('group', { name: /Did you file Form 4868/ });
  if (await ext.count()) await ext.getByText('No', { exact: true }).click();
  await page.waitForTimeout(400);
  console.log('can go on:', await page.getByText('You can go on').isVisible());
  console.log('returns:', (await page.locator('.download-row .list-title').allTextContents()).join(' | '));

  // FBAR-only years: copy from the nearest year, then fill a balance.
  const folds = page.locator('details.fold');
  console.log('FBAR years:', (await folds.locator('.fold-title').allTextContents()).join(', '));
  const first = folds.first();
  if (!(await first.evaluate((d) => d.open))) await first.locator('summary').click();
  const copy = first.getByRole('button', { name: /Copy accounts from/ });
  if (await copy.count()) { await copy.click(); await first.getByLabel(/Highest balance in/).first().fill('50000'); await first.getByLabel(/Highest balance in/).first().blur(); }
  for (let i = 1; i < await folds.count(); i++) {
    const f = folds.nth(i);
    if (await f.getByLabel(/I had no Canadian bank/).count()) { if (!(await f.evaluate((d) => d.open))) await f.locator('summary').click(); await f.getByLabel(/I had no Canadian bank/).check(); }
  }
  await page.getByLabel('Your personal background').fill('I moved to Canada in 2010 for work.');
  await page.getByLabel(/Why you did not report/).fill('I believed the Canadian return was enough.');
  await page.waitForTimeout(500);
  console.log('payment table:', (await page.locator('.ledger').last().innerText()).replace(/\s+/g, ' ').slice(0, 220));

  if (KEY) {
    for (const label of ['Your returns, ready to mail', 'Cover sheet and mailing checklist', 'Form 14653 worksheet', 'FBAR worksheets']) {
      const row = page.locator('.download-row', { hasText: label }).first();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), row.getByRole('button', { name: /Download PDF/ }).click()]);
      const out = path.join(OUT, `ui-${dl.suggestedFilename()}`);
      await dl.saveAs(out);
      console.log('downloaded', dl.suggestedFilename(), fs.statSync(out).size, 'bytes');
    }
    const form = await page.request.get(BASE.replace(/app\/$/, '') + 'forms/f14653.pdf');
    console.log('blank Form 14653 served:', form.status(), (await form.body()).length, 'bytes');
  } else console.log('no key file: skipped downloads. Unlock panel shown:', await page.getByText(/Unlock your/).count());

  await page.screenshot({ path: path.join(OUT, 'ui-catchup.png'), fullPage: true });
  console.log('console errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
