// Seeds a household that uses every newer section (self-employment, a sale, a fund, a TFSA, the physical
// presence test with housing) and checks the questions and results screens in a real browser.
// Usage: node scripts/sections-check.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5179/';
const OUT = resolve('../research/render_check/ui-sections');
mkdirSync(OUT, { recursive: true });

const slip = (id, type, boxes, extra = {}) => ({ id, type, owner: 'taxpayer', payer: extra.payer ?? 'Maple Co', year: 2025, boxes, reads: {}, edited: [], confirmed: true, ...extra });
const state = {
  version: 1, step: 'questions', year: 2025, filingStatus: 'single', spouseIsUsPerson: null,
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01', occupation: 'Designer' },
  spouse: { firstName: '', lastName: '', ssn: '', dateOfBirth: '' }, dependents: [],
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  livedInCanadaAllYear: true, digitalAssets: false, accountsOver10k: null, docs: [],
  slips: [
    slip('t4', 'T4', { '14': 60000 }),
    slip('t3', 'T3', { '49': 800 }, { payer: 'Maple Funds' }),
    slip('t5008', 'T5008', { '20': 9800, '21': 17500 }, { payer: 'RBC Direct Investing' }),
    slip('noa', 'NOA', { '15000': 140000, '23600': 140000, '42000': 20000, '42800': 11000 }),
  ],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  carryover: { general: 0, passive: 0, vintages: [] }, feieFacts: { bonaFideResident: true, residenceStart: '', daysInUs: 0 }, feie2555: {},
  accounts: [{ id: 'a1', owner: 'taxpayer', kind: 'tfsa', institution: 'RBC Direct Investing', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
    accountNumber: '555', maxValueCad: 60000, yearEndValueCad: 58000, opened: false, closed: false,
    registered: { openedDate: '2015-03-01', startValueCad: 50000, contributionsCad: 7000, withdrawalsCad: 0, interestCad: 300, companyDividendsCad: 1200, dividendsQualified: true, holdsInvestments: true, file3520: true } },
    { id: 'a2', owner: 'taxpayer', kind: 'bank', institution: 'RBC Royal Bank', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
      accountNumber: '123', maxValueCad: 30000, yearEndValueCad: 25000, opened: false, closed: false }],
  noAccounts: false,
  businesses: [{ id: 'b1', owner: 'taxpayer', name: 'Lee Design', activity: 'Graphic design', code: '541430', accounting: 'cash', grossCad: 60000, returnsCad: 0, cogsCad: 0, otherIncomeCad: 0,
    expensesCad: { '8': 1000, '18': 2000 }, mealsCad: 500, homeOffice: { homeSqM: 100, officeSqM: 10, regularExclusive: true },
    assets: [{ description: 'Camera', kind: 'computer', costCad: 6000, placedInService: '2025-11-20', businessUsePct: 100 }], deMinimis: true, capitalMaterial: false, materiallyParticipated: true }],
  sales: [{ id: 's1', owner: 'taxpayer', description: '100 sh Royal Bank', acquired: '2019-03-15', sold: '2025-06-02', proceedsCad: 17500, costCad: 9800, slipId: 't5008' }],
  pficFunds: [{ id: 'f1', owner: 'taxpayer', name: 'Maple Balanced Fund', account: 'taxable', regime: '1291', acquired: '2018-06-01', sharesYearEnd: 1000, valueYearEndCad: 40000,
    distributions: [{ date: '2025-12-15', amountCad: 800 }], priorDistributionsCad: [400, 400, 400], slipIds: ['t3'] }],
  capitalLossCarryover: null, years: {},
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const ctx = await browser.newContext({ viewport: process.env.MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE);
await page.evaluate((s) => localStorage.setItem('lou:v1', JSON.stringify(s)), state);
await page.reload();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/questions${process.env.MOBILE ? '-mobile' : ''}.png`, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 1) errors.push(`horizontal overflow ${overflow}px`);
for (const h of ['Self-employment', 'Canadian mutual funds and ETFs', 'Sales of investments', 'Your Canadian accounts']) {
  if (!(await page.getByRole('heading', { name: h }).count())) errors.push(`missing section: ${h}`);
}
await page.getByRole('button', { name: 'See my US return' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/results.png`, fullPage: true });
const titles = await page.locator('.flag-title, .callout-title, h3').allTextContents().catch(() => []);
console.log('flags/titles:', titles.slice(0, 30).join(' | '));
for (const [label, file] of [['Download PDF', 'return.pdf']]) {
  const d = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: label }).first().click();
  await (await d).saveAs(`${OUT}/${file}`);
}
await page.waitForTimeout(1500);
const got = await Promise.race([
  page.waitForEvent('download', { timeout: 60000 }).then(async (d) => { await d.saveAs(`${OUT}/form3520.pdf`); return 'ok'; }),
  (async () => { await page.locator('.download-row', { hasText: 'Form 3520 package' }).getByRole('button').click(); await page.waitForTimeout(15000);
    return 'no download: ' + (await page.getByText("The PDF couldn't be built").locator('..').allTextContents()).join(' '); })(),
]).catch((e) => 'error ' + e.message);
if (got !== 'ok') errors.push(`3520 package: ${got}`);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
