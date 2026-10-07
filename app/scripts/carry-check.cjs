// Reuse across years in a real browser: a household finished 2024 (and has an empty 2023 started). Opening 2025
// copies what rarely changes and asks for the new figures; opening 2023 offers to bring the items in.
// Usage: node scripts/carry-check.cjs [url]
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:5179/app/';

const slip = (id, type, boxes) => ({ id, type, owner: 'taxpayer', payer: 'Maple Co', year: 2024, boxes, reads: {}, edited: [], confirmed: true });
const y2024 = {
  step: 'accounts', filingStatus: 'single', spouseIsUsPerson: null, livedInCanadaAllYear: true, digitalAssets: false, accountsOver10k: null, docs: [],
  dependents: [{ firstName: 'Ava', lastName: 'Lee', ssn: '', relationship: 'Daughter', dateOfBirth: '2019-02-01', hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true }],
  slips: [slip('t4', 'T4', { '14': 90000 }), { ...slip('noa', 'NOA', { '15000': 90000, '23600': 90000, '42000': 11000, '42800': 6000 }) }],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  carryover: { general: 0, passive: 0, vintages: [] }, feieFacts: { bonaFideResident: true, residenceStart: '', daysInUs: 0 }, feie2555: {},
  accounts: [
    { id: 'a1', owner: 'taxpayer', kind: 'bank', institution: 'CIBC', street: '199 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5L 1A2', accountNumber: '111', maxValueCad: 20000, yearEndValueCad: 15000, opened: false, closed: false },
    { id: 'a2', owner: 'taxpayer', kind: 'tfsa', institution: 'CIBC', street: '199 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5L 1A2', accountNumber: '333', maxValueCad: 9000, yearEndValueCad: 9000, opened: false, closed: false,
      registered: { openedDate: '2015-01-02', startValueCad: 8000, contributionsCad: 500, withdrawalsCad: 0, interestCad: 50, companyDividendsCad: 0, dividendsQualified: true, holdsInvestments: false, file3520: true } },
  ],
  noAccounts: false, businesses: [], sales: [], pficFunds: [], capitalLossCarryover: null, carryFrom: null, carryDismissed: [],
};
const empty2023 = { ...y2024, step: 'you', slips: [], accounts: [], dependents: [], carryFrom: null };
const state = {
  version: 1, year: 2024, ...y2024,
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01', occupation: 'Designer' },
  spouse: { firstName: '', lastName: '', ssn: '', dateOfBirth: '' },
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  years: { 2023: empty2023 },
};

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate((s) => localStorage.setItem('lou:v1', JSON.stringify(s)), state);
  await page.reload();

  // New year: seeded automatically.
  await page.locator('.year-link', { hasText: '2025' }).click();
  await page.waitForTimeout(500);
  const s25 = await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1')));
  console.log('2025 started from', s25.carryFrom, '| status', s25.filingStatus, '| dependents', s25.dependents.map((d) => d.firstName).join(','),
    '| accounts', s25.accounts.map((a) => `${a.institution} ${a.accountNumber} max ${a.maxValueCad} carried ${a.carried}${a.registered ? ` start ${a.registered.startValueCad}` : ''}`).join('; '));
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('lou:v1')); s.step = 'accounts'; localStorage.setItem('lou:v1', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(500);
  console.log('2025 notes:', (await page.locator('.callout strong').allTextContents()).filter((t) => /Copied|Bring/.test(t)).join(' | '));
  console.log('2025 see-return disabled before:', await page.getByRole('button', { name: 'See my US return' }).isDisabled(),
    '|', await page.locator('.actions .small').first().textContent());
  await page.getByLabel('Highest balance in the year (CAD)').first().fill('21000');
  await page.getByLabel('Highest balance in the year (CAD)').first().blur();
  await page.getByRole('button', { name: 'The 2025 figures are in' }).first().click();
  await page.waitForTimeout(300);
  console.log('2025 carried left:', await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1')).accounts.filter((a) => a.carried).length));

  // Existing empty year: offered, not forced.
  await page.locator('.year-link', { hasText: '2023' }).click();
  await page.waitForTimeout(300);
  console.log('2023 About you offer:', (await page.locator('.callout strong').allTextContents()).filter((t) => /Bring/.test(t)).join(' | '));
  await page.getByRole('button', { name: 'Add it' }).click();
  await page.waitForTimeout(800); // let Lou's autosave run before the script edits the saved state
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('lou:v1')); s.step = 'accounts'; s.slips = []; localStorage.setItem('lou:v1', JSON.stringify(s)); });
  await page.reload();
  const offer = page.locator('.callout', { hasText: 'Bring in your accounts' });
  console.log('2023 accounts offer:', (await offer.innerText()).replace(/\s+/g, ' ').slice(0, 200));
  await offer.getByRole('button', { name: 'Add them' }).click();
  await page.waitForTimeout(300);
  const s23 = await page.evaluate(() => JSON.parse(localStorage.getItem('lou:v1')));
  console.log('2023 accounts:', s23.accounts.map((a) => `${a.accountNumber} carried ${a.carried} yearEnd ${a.yearEndValueCad}`).join('; '), '| dependents', s23.dependents.map((d) => d.firstName).join(','));
  await page.screenshot({ path: require('path').resolve('../research/render_check/ui-carry.png'), fullPage: true });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
