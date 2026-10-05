// Computes a full US return for a US person resident in Canada from confirmed
// inputs. Lines follow the 2025 Form 1040 numbering (2023/2024 share these
// line numbers for every line used here except 11b/13b, which are 2025-only).

import { buildIncome, cadToUsd } from './income';
import type { Flag, IncomeItem, ReturnInput } from './model';
import { dollars, line16Tax, qdcgWorksheet, type Line16Result } from './taxComputation';
import { computeAmt, type AmtResult } from './amt';
import { computeScheduleC, type ScheduleCResult } from './business';
import { bonaFide, daysInYear, housingPart6, physicalPresence, type PhysicalPresence } from './feie';
import { carryoverToNextYear, isLongTerm, saleRow, scheduleD, type CapitalLossCarryover, type Form8949Row, type ScheduleDResult } from './capital';
import { applyFilingException, computePfic, type PficResult } from './pfic';
import { isRegisteredTrust, needs3520, trust3520, type Trust3520 } from './foreignTrust';
import { statusKey, YEARS, type FilingStatus, type TaxYear } from './years';

// ---- Year constants that live outside years.ts because only this module uses them ----

/** Schedule 8812 (verified on each year's form). */
const CTC = {
  2025: { perChild: 2200, refundablePerChild: 1700 },
  2024: { perChild: 2000, refundablePerChild: 1700 },
  2023: { perChild: 2000, refundablePerChild: 1600 },
} as const;
const ODC_PER_DEPENDENT = 500;

/** Form 1116 adjustment exception thresholds = top of the 24% bracket (i1116 "Adjustment exception"). */
function adjustmentExceptionLimit(year: TaxYear, status: FilingStatus): number {
  return YEARS[year].brackets[statusKey(status)][3];
}

/** Form 8960 thresholds (not inflation-indexed, IRC 1411(b)). */
const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200000, hoh: 200000, mfj: 250000, qss: 250000, mfs: 125000 };

export type Category = 'general' | 'passive';

export interface Form1116 {
  category: Category;
  lines: Record<string, number>;
  /** Canadian tax allocated to this category, CAD. */
  taxCad: number;
  excessCredit: number;
  /** Schedule B (Form 1116): required when a carryover is used or generated. */
  scheduleB?: ScheduleB1116;
}

/** One column of Schedule B (Form 1116). Line 4, 5 and 7 amounts are negative, as entered on the form. */
export interface CarryColumn { l1: number; l3: number; l4: number; l5: number; l6: number; l7: number; l8: number }

export interface ScheduleB1116 {
  /** Key: years before the current year (10..1), or 0 for the current year. */
  cols: Record<number, CarryColumn>;
  /** Vintages carried to next year (year of origin -> amount), from line 8. */
  next: { year: number; amount: number }[];
}

/**
 * Schedule B (Form 1116) per its instructions: prior carryovers are used oldest
 * first, up to the current year's excess limitation (line 4); the 10th preceding
 * year's leftover expires (line 5); current-year excess foreign tax is generated
 * in column (xiii) (line 6). Line 7 (carryback) is 0; Lou flags when a carryback may apply.
 */
export function scheduleB1116(year: number, L: Record<string, number>, vintages: Map<number, number>): ScheduleB1116 {
  const cols: Record<number, CarryColumn> = {};
  const available = L['9'] - L['12'] + L['13'];
  let excessLimitation = Math.max(0, L['23'] - available);
  const excessForeign = Math.max(0, available - L['23']);
  for (let k = 10; k >= 1; k--) {
    const v = vintages.get(year - k) ?? 0;
    const use = Math.min(v, excessLimitation);
    excessLimitation -= use;
    const col: CarryColumn = { l1: v, l3: v, l4: -use || 0, l5: 0, l6: 0, l7: 0, l8: 0 };
    if (k === 10) col.l5 = -(col.l3 + col.l4) || 0;
    col.l8 = col.l3 + col.l4 + col.l5;
    cols[k] = col;
  }
  cols[0] = { l1: 0, l3: 0, l4: 0, l5: 0, l6: excessForeign, l7: 0, l8: excessForeign };
  const next: { year: number; amount: number }[] = [];
  for (const k of [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) if (cols[k].l8 > 0) next.push({ year: year - k, amount: cols[k].l8 });
  return { cols, next };
}

export interface Form2555 {
  owner: 'taxpayer' | 'spouse';
  foreignEarnedIncome: number;
  limit: number;
  exclusion: number;
  /** Form 2555 lines 19-50. */
  lines: Record<string, number>;
  test: 'bfr' | 'ppt';
  /** Physical presence test result (line 16 period). */
  ppt?: PhysicalPresence;
}


export interface ReturnResult {
  year: TaxYear;
  usedFeie: boolean;
  items: IncomeItem[];
  flags: Flag[];
  /** Form 1040 lines (whole dollars). Keys are line numbers as printed ('1h', '11a', ...). */
  f1040: Record<string, number>;
  schedule1: Record<string, number>;
  /** Schedule C, one per business. */
  scheduleC: ScheduleCResult[];
  schedule1a: Record<string, number>;
  schedule2: Record<string, number>;
  schedule3: Record<string, number>;
  scheduleB: { interest: { payer: string; amount: number }[]; dividends: { payer: string; amount: number }[] };
  schedule8812: Record<string, number>;
  f1116: Form1116[];
  f2555: Form2555[];
  f8960: Record<string, number>;
  /** Form 6251 (alternative minimum tax). */
  f6251: AmtResult;
  /** Schedule D and Form 8949, when filed. */
  scheduleD?: ScheduleDResult;
  /** Capital loss carryover to next year (Capital Loss Carryover Worksheet). */
  capitalLossNext: CapitalLossCarryover;
  /** Form 8621, one per fund. */
  pfic: PficResult[];
  /** TFSAs/FHSAs reported on Form 3520 with a substitute Form 3520-A (filed separately from the 1040). */
  trusts: Trust3520[];
  /** Net capital gain for the tax worksheets (Schedule D line 15/16, or capital gain distributions). */
  netCapitalGain: number;
  line16: Line16Result;
  /** Positive = refund, negative = amount owed. */
  refund: number;
  /** Canadian tax creditable in total (CAD) and in USD. */
  canadianTaxCad: number;
  needsForm8833: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function age65(dob: string | undefined, year: TaxYear): boolean {
  return !!dob && dob < YEARS[year].seniorBornBefore;
}

/** Creditable Canadian income tax for the year (CAD), from the Notice(s) of Assessment. */
export function creditableCanadianTax(input: ReturnInput): number {
  return sum(input.assessments.map((a) =>
    a.netFederalTax - (a.quebecAbatement ?? 0) + a.provincialTax + (a.quebecTax ?? 0)));
}

/** Compute one scenario. `withFeie` forces the Form 2555 choice. */
export function computeScenario(input: ReturnInput, withFeie: boolean): ReturnResult {
  const { year, filingStatus: status } = input;
  const Y = YEARS[year];
  const rate = Y.irsAvgCadPerUsd;
  const { items, flags } = buildIncome(input);

  // ---- Self-employment (Schedule C) ----
  const scheduleC = (input.businesses ?? []).map((b) => computeScheduleC(year, b));
  for (const c of scheduleC) {
    flags.push(...c.flags);
    const b = c.business;
    const L = c.lines;
    items.push({
      slipId: b.id, slipType: 'T2125', box: '31', owner: b.owner, description: `Self-employment - ${b.name || b.activity || 'business'} (T2125)`,
      cad: Math.round(L['31'] * rate * 100) / 100, usd: L['31'], usLine: 's1_3', category: 'general', earned: true, qualifiedDividend: false,
      selfEmployment: true, grossUsd: L['7'], expensesUsd: L['28'] + L['30'],
      canadianTaxableCad: Math.max(0, b.canadianNetCad ?? L['31'] * rate),
      sources: ['Instructions for Schedule C', 'Instructions for Schedule SE (totalization agreements)', 'US-Canada Agreement on Social Security, Art. V'],
    });
  }
  if (scheduleC.length) flags.push({ id: 'se-totalization', severity: 'info',
    title: 'No US self-employment tax: you pay into CPP/QPP instead',
    detail: 'The US-Canada social security agreement covers self-employed people only in the country where they live. Lou leaves out Schedule SE and writes "Exempt, see attached statement" on Schedule 2, line 4. Attach a copy of your certificate of coverage: ask the CRA for form CPT56 (Quebec residents: Retraite Québec). Because the income is exempt from US self-employment tax, it does not count toward the refundable child tax credit.' });
  // Canadian tax per CAD of Canadian taxable income: the apportionment the foreign tax credit uses.
  const caTaxable0 = sum(items.map((i) => i.canadianTaxableCad));
  const caTaxPerCad = caTaxable0 > 0 ? creditableCanadianTax(input) / caTaxable0 : 0;

  // ---- PFICs (Form 8621): replace the linked slips' fund distributions with the PFIC treatment ----
  const pfic: PficResult[] = [];
  const pficRows: Form8949Row[] = [];
  let qefGain = 0;
  for (const fund of input.pficFunds ?? []) {
    const linked = items.filter((i) => fund.slipIds?.includes(i.slipId) && i.usLine === '3b');
    const slipTaxable = sum(linked.map((i) => i.canadianTaxableCad));
    for (const i of linked) items.splice(items.indexOf(i), 1);
    const fundSales = (input.sales ?? []).filter((s) => s.pficFundId === fund.id);
    const r = computePfic(year, fund, fundSales.map((s) => ({ date: s.sold, acquired: s.acquired, shares: 1, proceedsCad: s.proceedsCad, costCad: s.costCad })), rate, caTaxPerCad);
    pfic.push(r);
    const owner = fund.owner === 'spouse' ? 'spouse' : 'taxpayer';
    // Canadian taxable amounts follow the income: what the US taxes this year vs. the deferred (prior-year) part.
    const saleTaxable = 0.5 * Math.max(0, sum(fundSales.map((s) => s.proceedsCad - s.costCad)));
    const deferredUsd = sum(r.details.flatMap((d) => d.result.rows.map((x) => x.allocated)));
    const currentUsd = sum(r.items.filter((x) => x.kind === 'dividend' || x.kind === 'ordinary').map((x) => Math.max(0, x.usd)));
    const pool = slipTaxable + saleTaxable;
    const share = (usd: number) => (currentUsd + deferredUsd > 0 ? pool * (Math.max(0, usd) / (currentUsd + deferredUsd)) : 0);
    for (const x of r.items) {
      if (x.kind === 'capitalLoss') {
        pficRows.push({ description: x.description, acquired: x.acquired!, sold: x.date!, proceeds: dollars(x.proceedsUsd!), basis: dollars(x.basisUsd!),
          gain: dollars(x.proceedsUsd!) - dollars(x.basisUsd!), longTerm: isLongTerm(x.acquired!, x.date!), owner });
        continue;
      }
      if (x.kind === 'qefCapitalGain') { qefGain += dollars(x.usd); continue; }
      items.push({ slipId: fund.id, slipType: 'PFIC', box: x.kind, owner, description: x.description, cad: Math.round(x.cad * 100) / 100, usd: Math.round(x.usd * 100) / 100,
        usLine: x.kind === 'dividend' ? '3b' : 's1_8z', category: 'passive', earned: false, qualifiedDividend: false,
        canadianTaxableCad: share(x.usd), sources: ['Instructions for Form 8621 (Rev. December 2025)', 'IRC 1291-1298'] });
    }
    if (deferredUsd > 0) items.push({ slipId: fund.id, slipType: 'PFIC', box: '16c', owner, description: `${fund.name} section 1291 deferred amount (taxed on Form 8621 line 16c)`,
      cad: 0, usd: deferredUsd, usLine: 'excluded', deferred: true, category: 'passive', earned: false, qualifiedDividend: false, canadianTaxableCad: share(deferredUsd), sources: ['IRC 1291(a)'] });
    for (const n of r.notes) flags.push({ id: `pfic-note-${fund.id}-${n.slice(0, 20)}`, severity: 'info', title: `${fund.name}: Form 8621`, detail: n });
  }
  applyFilingException(pfic, status === 'mfj');
  // The old per-slip PFIC reminders are answered by the fund list.
  if (pfic.length) for (let k = flags.length - 1; k >= 0; k--) {
    const f = flags[k];
    if (f.id.startsWith('pfic-') && !f.id.startsWith('pfic-note-') && (input.pficFunds ?? []).some((fd) => fd.slipIds?.includes(f.slipId ?? ''))) flags.splice(k, 1);
  }

  // ---- TFSA, FHSA, RESP: income inside is US-taxable each year (grantor trust rules) ----
  for (const a of (input.accounts ?? []).filter(isRegisteredTrust)) {
    const d = a.registered;
    if (!d) {
      flags.push({ id: `registered-${a.id}`, severity: 'block', title: `Income inside your ${a.kind.toUpperCase()} is needed`,
        detail: `The US taxes interest, dividends and gains inside a ${a.kind.toUpperCase()} every year. Fill in the account's details on the questions step (zero is fine if it earned nothing).` });
      continue;
    }
    const owner = a.owner === 'spouse' ? 'spouse' : 'taxpayer';
    const label = `${a.kind.toUpperCase()} - ${a.institution || 'account'}`;
    const base = { slipId: a.id, slipType: 'SALES' as const, owner: owner as 'taxpayer' | 'spouse', category: 'passive' as const, earned: false,
      canadianTaxableCad: 0, sources: ['IRC 671-679; Instructions for Form 3520-A (Foreign Grantor Trust Owner Statement)'] };
    if (d.interestCad) items.push({ ...base, box: 'interest', description: `Interest - ${label}`, cad: d.interestCad, usd: cadToUsd(d.interestCad, rate), usLine: '2b', qualifiedDividend: false });
    if (d.companyDividendsCad) items.push({ ...base, box: 'dividends', description: `Dividends - ${label}`, cad: d.companyDividendsCad, usd: cadToUsd(d.companyDividendsCad, rate), usLine: '3b', qualifiedDividend: d.dividendsQualified });
    if (a.kind === 'resp') flags.push({ id: `resp-${a.id}`, severity: 'info', title: 'RESP: income reported, no Form 3520',
      detail: 'An RESP fits the IRS relief for foreign education savings trusts (Rev. Proc. 2020-17, section 5.04), so it needs no Form 3520 or 3520-A. Its income is still US-taxable each year to the person who opened it, and it stays on your FBAR and Form 8938.' });
    else if (!needs3520(a)) flags.push({ id: `no3520-${a.id}`, severity: 'warn', title: `${a.kind.toUpperCase()}: you chose not to file Form 3520`,
      detail: 'The IRS has never said whether these accounts are foreign trusts. If it treats yours as one, the penalty for a missing Form 3520-A is the greater of $10,000 or 5% of the account. Lou still reports the income.' });
  }

  // ---- Sales (Form 8949 / Schedule D) ----
  const saleRows = (input.sales ?? []).filter((s) => !s.pficFundId).map((s) => saleRow(s, flags)).filter((x): x is Form8949Row => !!x);
  const allRows = [...saleRows, ...pficRows];
  const carryIn = input.capitalLossCarryover ?? { shortTerm: 0, longTerm: 0 };
  const cgdUsd = dollars(sum(items.filter((i) => i.usLine === 'sd_13').map((i) => i.usd)));
  const needsSchD = allRows.length > 0 || carryIn.shortTerm > 0 || carryIn.longTerm > 0 || qefGain !== 0;
  const schD = needsSchD ? scheduleD(status, allRows, carryIn, cgdUsd, qefGain) : undefined;
  if (schD) {
    // One item carries the sales' net (line 7 less distributions) for Form 1116; it isn't added to line 7a again.
    const capNet = schD.line7 - cgdUsd;
    const gainCad = sum((input.sales ?? []).filter((s) => !s.pficFundId).map((s) => s.proceedsCad - s.costCad));
    // IRC 865(g)(2): a US citizen with a foreign tax home has foreign-source gain only if Canada taxes it at 10% or more.
    const caRateOnGain = caTaxPerCad * 0.5;
    const usSource = caRateOnGain < 0.10;
    if (capNet !== 0) items.push({ slipId: 'sales', slipType: 'SALES', box: 'D', owner: 'taxpayer', description: 'Net gain or loss on sales (Schedule D)',
      cad: gainCad, usd: capNet, usLine: 'sd_net', category: 'passive', earned: false, qualifiedDividend: false,
      prefUsd: Math.max(0, Math.min(capNet, schD.qdcgLine3 - cgdUsd)), usSource, canadianTaxableCad: Math.max(0, 0.5 * gainCad), sources: ['IRC 865(a), (g)(2); Pub 514'] });
    if (usSource && capNet > 0) flags.push({ id: 'gain-us-source', severity: 'info',
      title: 'Your gains count as US income for the foreign tax credit',
      detail: 'A US citizen living abroad treats a gain on shares as foreign income only when the foreign country taxes it at 10% or more (IRC 865(g)(2)). Canada taxes half of a gain, and your average Canadian rate puts that under 10%, so the Canadian tax on these gains can\'t be credited. The treaty (Art. XXIV(3)) can re-source the gain on a separate Form 1116; Lou does not do that.' });
    if (saleRows.length) flags.push({ id: 'sales-lots', severity: 'info', title: 'US cost uses each purchase, not the Canadian average cost',
      detail: 'Canada pools identical shares at an average cost; the US uses the cost of the specific shares sold (first bought, first sold, unless you identified them). If you bought the same security more than once, enter each purchase as its own sale line.' });
  }
  const taxed = items.filter((i) => i.usLine !== 'excluded');
  const lineTotal = (line: IncomeItem['usLine']) => dollars(sum(taxed.filter((i) => i.usLine === line).map((i) => i.usd)));

  // ---- Income ----
  const f1040: Record<string, number> = {};
  f1040['1h'] = lineTotal('1h');
  f1040['1z'] = f1040['1h'];
  f1040['2b'] = lineTotal('2b');
  f1040['3b'] = lineTotal('3b');
  f1040['3a'] = dollars(sum(taxed.filter((i) => i.qualifiedDividend).map((i) => i.usd)));
  const pensionGross = dollars(sum(taxed.filter((i) => i.usLine === '5b').map((i) => cadToUsd(i.cad, rate))));
  f1040['5b'] = lineTotal('5b');
  f1040['5a'] = pensionGross;
  // Schedule D when there are sales, carryovers or QEF gains; otherwise distributions go straight on line 7 (box checked).
  f1040['7a'] = schD ? schD.line7 : lineTotal('sd_13');
  const netCapitalGain = schD ? schD.qdcgLine3 : f1040['7a'];

  // ---- Form 2555 (per person): bona fide residence or physical presence, housing, exclusion ----
  const f2555: Form2555[] = [];
  if (withFeie) {
    for (const owner of ['taxpayer', 'spouse'] as const) {
      const mine = taxed.filter((i) => i.earned && i.owner === owner);
      const wages = dollars(sum(mine.filter((i) => !i.selfEmployment).map((i) => i.usd)));
      // Line 20a: gross business income is earned income when personal services produce it; when
      // capital is a material factor, at most 30% of the net profit (i2555, line 20).
      const bizItems = mine.filter((i) => i.selfEmployment);
      const capital = scheduleC.some((c) => c.business.owner === owner && c.business.capitalMaterial);
      const business = dollars(sum(bizItems.map((i) => (capital ? Math.max(0, i.usd) * 0.3 : Math.max(0, i.grossUsd ?? i.usd)))));
      const fei = wages + business;
      if (fei <= 0) continue;
      const d = input.feie2555?.[owner];
      const who = owner === 'spouse' ? "your spouse's" : 'your';
      const yearDays = daysInYear(year);

      // Qualifying days in the tax year (lines 31/38).
      const test = d?.test ?? 'bfr';
      let qualDays = yearDays;
      let ppt: ReturnType<typeof physicalPresence> | undefined;
      if (test === 'ppt') {
        ppt = physicalPresence(year, d?.residenceStart ?? '', d?.trips ?? [], undefined, input.asOf);
        qualDays = ppt.daysInTaxYear;
        if (!ppt.qualifies) flags.push({ id: `2555-ppt-${owner}`, severity: 'block',
          title: 'The physical presence test is not met',
          detail: `It needs 330 full days outside the US in 12 months in a row. The best 12-month period Lou found has ${ppt.fullDays} full days. Use the foreign tax credit for ${year} instead.` });
      } else if (d?.residenceStart) {
        const bf = bonaFide(year, d.residenceStart, input.asOf);
        qualDays = bf.daysInTaxYear;
        if (bf.waitForNextYear) flags.push({ id: `2555-bfr-wait-${owner}`, severity: 'block',
          title: `The bona fide residence test needs all of ${year + 1} too`,
          detail: `Residence began during ${year}, so it qualifies only once it has lasted through December 31, ${year + 1}. Use the physical presence test if you meet it, or file Form 2350 for more time. Lou counts the days from ${d.residenceStart} meanwhile.` });
        else if (!bf.qualifies) flags.push({ id: `2555-bfr-${owner}`, severity: 'block',
          title: 'The bona fide residence test is not met',
          detail: `Residence must cover an entire tax year. Use the foreign tax credit for ${year} instead.` });
      }
      if (test === 'bfr' && !input.feieFacts?.bonaFideResident && !(d?.residenceStart && d.residenceStart > `${year}-01-01`)) flags.push({ id: 'feie-facts', severity: 'block',
        title: 'Form 2555 needs Canadian residence for the qualifying period',
        detail: 'You said you did not live in Canada all year. Enter the date your residence began, or use the physical presence test on the Form 2555 questions.' });

      const L: Record<string, number> = {};
      L['19'] = wages; L['20a'] = business;
      L['24'] = fei; L['25'] = 0; L['26'] = fei; L['27'] = fei;
      // Part VI housing exclusion: employer-provided amounts include wages (i2555, line 34).
      if (d?.housing && d.housing.expensesCad > 0) {
        const h = housingPart6(year, { expensesUsd: d.housing.expensesCad / rate, location: d.housing.location }, qualDays, L['27'], wages);
        Object.assign(L, h);
        L['36'] = h['36'] ?? 0;
      } else L['36'] = 0;
      L['37'] = Y.feieMax; L['38'] = qualDays;
      L['39'] = qualDays >= yearDays ? 1 : Math.round((qualDays / yearDays) * 1000) / 1000;
      L['40'] = dollars(L['37'] * L['39']);
      L['41'] = L['27'] - L['36'];
      L['42'] = Math.max(0, Math.min(L['40'], L['41']));
      L['43'] = L['36'] + L['42'];
      // Line 44: business expenses allocable to the excluded income are not deductible (i2555; Pub 54).
      const bizExpenses = capital ? 0 : sum(bizItems.map((i) => i.expensesUsd ?? 0));
      L['44'] = L['27'] > 0 ? dollars(bizExpenses * Math.min(1, L['43'] / L['27'])) : 0;
      L['45'] = L['43'] - L['44'];
      // Part IX housing deduction (self-employment share): when line 33 > line 36 and line 27 > line 43.
      if ((L['33'] ?? 0) > L['36'] && L['27'] > L['43']) {
        L['46'] = L['33'] - L['36'];
        L['47'] = L['27'] - L['43'];
        L['48'] = Math.min(L['46'], L['47']);
        L['50'] = L['48'];
        if (L['46'] > L['48']) flags.push({ id: `2555-housing-carry-${owner}`, severity: 'info',
          title: 'Part of your housing deduction can carry to next year',
          detail: `$${(L['46'] - L['48']).toLocaleString('en-US')} of the housing deduction was limited. It can be carried to ${year + 1} only (Form 2555, line 49 next year).` });
      }
      if (capital && bizItems.length) flags.push({ id: `2555-capital-${owner}`, severity: 'warn',
        title: 'Business with significant capital: check Form 2555 line 44',
        detail: 'Lou counts 30% of the business profit as earned income and allocates no further expenses to the excluded amount. Review the allocation in Pub 54 before filing.' });
      f2555.push({ owner, foreignEarnedIncome: fei, limit: L['40'], exclusion: L['45'], lines: L, test, ppt });

      const missing = !d ? ['everything'] : [
        !d.residenceStart && (test === 'ppt' ? 'the date you arrived in Canada' : 'the date your Canadian residence began'),
        d.filedBefore === null && 'whether you filed Form 2555 before',
        test === 'bfr' && !d.quarters && 'your kind of housing',
        test === 'bfr' && d.familyWithYou === null && 'whether family lived with you',
        test === 'bfr' && !d.status && 'your status in Canada',
        test === 'bfr' && d.visaLimited === null && 'whether your status limited your stay',
      ].filter(Boolean);
      if (missing.length) flags.push({ id: `2555-details-${owner}`, severity: 'block',
        title: `Form 2555 needs a few more details for ${who} earned income`,
        detail: `Answer the Form 2555 questions on the questions step (missing: ${missing.join(', ')}). The IRS can disallow the exclusion if Part I, II or III is incomplete.` });
      if (d?.trips.some((t) => t.businessDays > 0)) flags.push({ id: `2555-us-work-${owner}`, severity: 'warn',
        title: 'Work done while in the US is not foreign earned income',
        detail: 'Pay for days you worked in the US must come out of Form 2555 and is fully taxable in the US. Lou uses your full Canadian earnings; reduce Part IV by the US-workday share and attach the computation.' });
    }
  }
  const feieExcluded = sum(f2555.map((f) => f.exclusion));
  /** Form 2555 lines 45 + 50 (exclusions plus housing deduction): what the tax worksheets and MAGI add back. */
  const housingDeduction = sum(f2555.map((f) => f.lines['50'] ?? 0));
  const feieAddBack = feieExcluded + housingDeduction;

  const schedule1: Record<string, number> = {};
  schedule1['3'] = lineTotal('s1_3');
  schedule1['7'] = lineTotal('s1_7');
  schedule1['8z'] = lineTotal('s1_8z');
  schedule1['8d'] = feieExcluded ? -feieExcluded : 0;
  schedule1['9'] = schedule1['8d'] + schedule1['8z'];
  schedule1['10'] = schedule1['3'] + schedule1['7'] + schedule1['9'];
  // Adjustments: housing deduction (Form 2555 line 50) on line 24j.
  schedule1['24j'] = housingDeduction;
  schedule1['26'] = schedule1['24j'];
  f1040['8'] = schedule1['10'];
  f1040['9'] = f1040['1z'] + f1040['2b'] + f1040['3b'] + f1040['5b'] + f1040['7a'] + f1040['8'];
  f1040['10'] = schedule1['26'];
  f1040['11a'] = f1040['9'] - f1040['10'];
  f1040['11b'] = f1040['11a'];

  // ---- Deductions ----
  const k = statusKey(status);
  const married = status === 'mfj' || status === 'mfs' || status === 'qss';
  const boxes = [
    age65(input.taxpayer.dateOfBirth, year), !!input.taxpayer.blind,
    status === 'mfj' && age65(input.spouse?.dateOfBirth, year), status === 'mfj' && !!input.spouse?.blind,
  ].filter(Boolean).length;
  f1040['12e'] = Y.standardDeduction[k] + boxes * (married ? Y.additionalStdDeduction.married : Y.additionalStdDeduction.unmarried);

  const schedule1a: Record<string, number> = {};
  if (year === 2025 && status !== 'mfs') {
    schedule1a['3'] = f1040['11b'] + feieAddBack; // MAGI adds back Form 2555 lines 45 and 50 (lines 2b, 2c)
    const over = Math.max(0, schedule1a['3'] - (status === 'mfj' ? 150000 : 75000));
    schedule1a['35'] = Math.max(0, 6000 - dollars(over * 0.06));
    schedule1a['36a'] = input.taxpayer.ssn && age65(input.taxpayer.dateOfBirth, year) ? schedule1a['35'] : 0;
    schedule1a['36b'] = status === 'mfj' && input.spouse?.ssn && age65(input.spouse.dateOfBirth, year) ? schedule1a['35'] : 0;
    schedule1a['37'] = schedule1a['36a'] + schedule1a['36b'];
    schedule1a['38'] = schedule1a['37'];
  }
  f1040['13a'] = 0;
  f1040['13b'] = schedule1a['38'] ?? 0;
  f1040['14'] = f1040['12e'] + f1040['13a'] + f1040['13b'];
  f1040['15'] = Math.max(0, f1040['11b'] - f1040['14']);

  // ---- Tax ----
  const line16 = line16Tax(year, status, {
    taxableIncome: f1040['15'], qualifiedDividends: f1040['3a'], netCapitalGain, feieExcluded: feieAddBack,
  });
  // Section 1291 deferred tax goes on line 16 too (box 3, "1291TAX"; i8621 line 16e).
  const pficTax = dollars(sum(pfic.map((p) => p.deferredTax)));
  f1040['16'] = line16.tax + pficTax;
  const schedule2: Record<string, number> = { '1z': 0 };

  // ---- Foreign tax credit (Form 1116, one per category) ----
  const canadianTaxCad = creditableCanadianTax(input);
  const qdAdj = qdAdjustment(input, f1040, line16, netCapitalGain);
  const feieGross = sum(f2555.map((f) => f.lines['43']));
  const feieDisallowed = sum(f2555.map((f) => f.lines['44'] ?? 0));
  const f1116 = computeFtc(input, taxed, items, f1040, schedule1a, schedule2, qdAdj, netCapitalGain, pficTax, { net: feieExcluded, gross: feieGross, disallowed: feieDisallowed }, canadianTaxCad, flags);
  // Form 1116 Part IV: line 32 = sum of category credits; line 33/35 = smaller of line 20 or line 32.
  const schedule3: Record<string, number> = {};
  const line32 = sum(f1116.map((f) => f.lines['24']));
  schedule3['1'] = Math.min(line32, f1040['16'] - pficTax + schedule2['1z']);
  schedule3['8'] = schedule3['1'];

  // ---- Alternative minimum tax (Form 6251). Needs Schedule 3 line 1 for its line 10. ----
  const f6251 = computeAmt({
    year, status, f1040, schedule1a, schedule2, schedule3, line16, feieExcluded: feieAddBack, taxed, f1116, feieGross, feieDisallowed, netCapitalGain,
    adjustmentException: qdAdj.exceptionOk && !!input.elections.useAdjustmentException,
    amtCarryover: input.carryover?.amtVintages,
  });
  flags.push(...f6251.flags);
  schedule2['2'] = f6251.amt;
  schedule2['3'] = schedule2['1z'] + schedule2['2'];
  f1040['17'] = schedule2['3'];
  f1040['18'] = f1040['16'] + f1040['17'];

  // ---- Child tax credit / credit for other dependents (Schedule 8812) ----
  const s8812 = computeCtc(input, f1040, schedule3, feieAddBack, f2555.length > 0, taxed, pficTax);
  f1040['19'] = s8812['14'] ?? 0;
  f1040['20'] = schedule3['8'];
  f1040['21'] = f1040['19'] + f1040['20'];
  f1040['22'] = Math.max(0, f1040['18'] - f1040['21']);

  // ---- Net investment income tax (Form 8960) ----
  // Form 8960 MAGI worksheet: adds back the earned income exclusion (line 42) less line 44 deductions allocable to it.
  const niitAddBack = sum(f2555.map((f) => f.lines['42'] - (f.lines['43'] > 0 ? f.lines['44'] * (f.lines['42'] / f.lines['43']) : 0)));
  const f8960 = computeNiit(status, f1040, dollars(niitAddBack), dollars(sum(taxed.filter((i) => i.slipType === 'PFIC' && i.usLine === 's1_8z').map((i) => i.usd))));
  schedule2['12'] = f8960['17'] ?? 0;
  // Interest on the section 1291 deferred tax (Form 8621 line 16f) -> line 17p.
  schedule2['17p'] = dollars(sum(pfic.map((p) => p.interest)));
  schedule2['18'] = schedule2['17p'];
  schedule2['21'] = schedule2['12'] + schedule2['18'];
  f1040['23'] = schedule2['21'];
  f1040['24'] = f1040['22'] + f1040['23'];

  // ---- Payments ----
  f1040['25d'] = 0; // Canadian withholding is not a US payment
  f1040['28'] = s8812['27'] ?? 0;
  f1040['32'] = f1040['28'];
  f1040['33'] = f1040['25d'] + f1040['32'];
  const refund = f1040['33'] - f1040['24'];
  if (refund >= 0) { f1040['34'] = refund; f1040['35a'] = refund; } else { f1040['37'] = -refund; }

  const scheduleB = {
    interest: taxed.filter((i) => i.usLine === '2b').map((i) => ({ payer: i.description, amount: dollars(i.usd) })),
    dividends: taxed.filter((i) => i.usLine === '3b').map((i) => ({ payer: i.description, amount: dollars(i.usd) })),
  };

  return {
    year, usedFeie: withFeie && feieAddBack > 0, items, flags, f1040, schedule1, scheduleC, schedule1a, schedule2, schedule3,
    scheduleB, schedule8812: s8812, f1116, f2555, f8960, f6251, line16, refund, canadianTaxCad, scheduleD: schD, pfic, netCapitalGain,
    trusts: (input.accounts ?? []).filter((a) => isRegisteredTrust(a) && needs3520(a) && a.registered).map((a) => {
      const rows = (input.sales ?? []).filter((x) => x.accountId === a.id && !x.pficFundId).map((x) => saleRow(x, [])).filter((x): x is Form8949Row => !!x);
      return trust3520(year, a, { shortTerm: sum(rows.filter((x) => !x.longTerm).map((x) => x.gain)), longTerm: sum(rows.filter((x) => x.longTerm).map((x) => x.gain)) });
    }),
    capitalLossNext: schD ? carryoverToNextYear(schD.lines, f1040['11b'] - f1040['14']) : { shortTerm: 0, longTerm: 0 },
    needsForm8833: items.some((i) => i.usLine === 'excluded' && !i.deferred),
  };
}

interface QdAdjustment { ws: Record<number, number>; exceptionOk: boolean; adjust: boolean }

/** Whether foreign qualified dividends must be adjusted (i1116 "Foreign Qualified Dividends and Capital Gains"). */
function qdAdjustment(input: ReturnInput, f1040: Record<string, number>, line16: Line16Result, netCapitalGain: number): QdAdjustment {
  const { year, filingStatus: status } = input;
  const qd = f1040['3a'];
  const cgd = netCapitalGain;
  const ws = line16.method === 'qdcg' ? line16.worksheet
    : qdcgWorksheet(year, status, { taxableIncome: f1040['15'], qualifiedDividends: qd, netCapitalGain: cgd }).lines;
  const mustAdjust = (qd + cgd) > 0 && ws[5] > 0 && ws[23] < ws[24];
  const exceptionOk = ws[5] <= adjustmentExceptionLimit(year, status) && qd + cgd < 20000;
  return { ws, exceptionOk, adjust: mustAdjust && !(exceptionOk && input.elections.useAdjustmentException) };
}

function computeFtc(
  input: ReturnInput, taxed: IncomeItem[], allItems: IncomeItem[], f1040: Record<string, number>,
  s1a: Record<string, number>, s2: Record<string, number>, qdAdj: QdAdjustment, netCapitalGain: number, pficTax: number,
  feie: { net: number; gross: number; disallowed: number }, canadianTaxCad: number, flags: Flag[],
): Form1116[] {
  const feieExcluded = feie.net;
  const { year } = input;
  const rate = YEARS[year].irsAvgCadPerUsd;
  // Business income enters Form 1116 gross (line 1a) with its expenses on line 2.
  const grossOf = (i: IncomeItem) => i.grossUsd ?? i.usd;
  // US-source items (IRC 865(g)(2) gains) belong to no category.
  const inCat = (i: IncomeItem, cat: Category) => i.category === cat && !i.usSource;
  const usdOf = (cat: Category) => sum(taxed.filter((i) => inCat(i, cat)).map(grossOf));

  // Apportion Canadian tax by Canadian-law income in each category (i1116 Part II; Pub 514).
  // Tax on income the US excludes by treaty (e.g. CPP/OAS) is not creditable.
  const caBase = sum(allItems.map((i) => i.canadianTaxableCad));
  const caShare = (cat: Category) => caBase > 0
    ? sum(taxed.filter((i) => inCat(i, cat)).map((i) => i.canadianTaxableCad)) / caBase : 0;
  const assessedIncome = sum(input.assessments.map((a) => a.totalIncome));
  if (assessedIncome > 0 && Math.abs(caBase - assessedIncome) / assessedIncome > 0.02) {
    flags.push({ id: 'noa-mismatch', severity: 'warn',
      title: 'Your slips do not add up to the income on your Notice of Assessment',
      detail: `Slips total about $${Math.round(caBase).toLocaleString()} CAD of Canadian taxable income; your assessment shows $${Math.round(assessedIncome).toLocaleString()}. Missing income (rental, self-employment, other slips) changes how Canadian tax is split for the credit.` });
  }

  // Qualified dividend adjustment (i1116 "Foreign Qualified Dividends and Capital Gains").
  const { ws, adjust } = qdAdj;
  const pref = f1040['3a'] + netCapitalGain;
  // Effective multiplier on preferential income: 0% part dropped, 15% x 0.4054, 20% x 0.5405.
  const prefFactor = adjust && pref > 0 ? (ws[17] * 0.4054 + ws[20] * 0.5405) / pref : 1;

  let line18 = f1040['11b'] - f1040['14'] + (s1a['37'] ?? 0);
  if (adjust) {
    // Worksheet for Line 18 (lines 6-12; 28%/25% gains not supported).
    const w11 = ws[20] * 0.4595 + ws[17] * 0.5946 + ws[9];
    line18 = Math.max(0, line18 - dollars(w11));
  }
  line18 = Math.max(0, line18);

  // Gross income from all sources incl. excluded income; business income counted gross.
  const grossAll = f1040['9'] + feieExcluded + sum(taxed.map((i) => i.expensesUsd ?? 0));
  // Regular tax liability: the section 1291 deferred tax is offset only on Form 8621 line 16d.
  const line20 = f1040['16'] - pficTax + s2['1z'];
  const results: Form1116[] = [];

  for (const cat of ['passive', 'general'] as Category[]) {
    const catItems = taxed.filter((i) => inCat(i, cat));
    if (!catItems.length) continue;
    const L: Record<string, number> = {};
    const prefOf = (i: IncomeItem) => (i.qualifiedDividend || i.usLine === 'sd_13' ? i.usd : i.prefUsd ?? 0);
    const prefInCat = sum(catItems.map(prefOf));
    const otherInCat = sum(catItems.map((i) => grossOf(i) - prefOf(i)));
    // Excluded income stays off line 1a (gross), and line 2 drops the expenses Form 2555 line 44 disallows.
    const excludedHere = cat === 'general' ? feie.gross : 0;
    L['1a'] = dollars(otherInCat - excludedHere + prefInCat * prefFactor);
    L['2'] = dollars(sum(catItems.map((i) => i.expensesUsd ?? 0)) - (cat === 'general' ? feie.disallowed : 0));
    L['3a'] = f1040['12e'];
    L['3b'] = 0;
    L['3c'] = L['3a'] + L['3b'];
    L['3d'] = dollars(usdOf(cat)); // includes excluded income, unadjusted
    L['3e'] = dollars(grossAll);
    L['3f'] = L['3e'] > 0 ? Math.min(1, Math.round((L['3d'] / L['3e']) * 10000) / 10000) : 0;
    L['3g'] = dollars(L['3c'] * L['3f']);
    L['6'] = L['2'] + L['3g'];
    L['7'] = L['1a'] - L['6'];

    const taxCad = canadianTaxCad * caShare(cat);
    L['8'] = dollars(cadToUsd(taxCad, rate));
    L['9'] = L['8'];
    // Carryovers by year of origin (only the 10 preceding years can still be used).
    const vintages = new Map<number, number>();
    if (input.carryover?.vintages?.length) {
      for (const v of input.carryover.vintages) {
        if (v.year >= year - 10 && v.year < year) vintages.set(v.year, (vintages.get(v.year) ?? 0) + dollars(v[cat]));
      }
    } else {
      const total = dollars(cat === 'general' ? input.carryover?.general ?? 0 : input.carryover?.passive ?? 0);
      if (total) vintages.set(year - 1, total); // year of origin unknown: treated as last year's
    }
    L['10'] = [...vintages.values()].reduce((a, b) => a + b, 0);
    L['11'] = L['9'] + L['10'];
    // Line 12: taxes allocable to excluded foreign earned income (general category only).
    if (excludedHere > 0) {
      // Canadian tax on earned income = category tax x (earned / category) under Canadian law,
      // then x (excluded / total foreign earned income) per i1116 line 12.
      const earnedHere = sum(catItems.filter((i) => i.earned).map(grossOf));
      const caCat = sum(catItems.map((i) => i.canadianTaxableCad));
      const caEarned = sum(catItems.filter((i) => i.earned).map((i) => i.canadianTaxableCad));
      const earnedTaxShare = caCat > 0 ? caEarned / caCat : 0;
      const fraction = earnedHere > 0 ? Math.min(1, excludedHere / earnedHere) : 0;
      L['12'] = dollars(L['9'] * earnedTaxShare * fraction);
    } else L['12'] = 0;
    L['13'] = 0;
    L['14'] = L['11'] - L['12'] + L['13'];
    L['15'] = L['7'];
    L['16'] = 0;
    L['17'] = L['15'] + L['16'];
    L['18'] = line18;
    L['19'] = L['17'] <= 0 || L['18'] <= 0 ? 0 : Math.min(1, Math.round((L['17'] / L['18']) * 10000) / 10000);
    L['20'] = line20;
    L['21'] = dollars(L['20'] * L['19']);
    L['22'] = 0;
    L['23'] = L['21'] + L['22'];
    L['24'] = Math.max(0, Math.min(L['14'], L['23']));
    const schB = scheduleB1116(year, L, vintages);
    const needsSchB = L['10'] > 0 || schB.cols[0].l6 > 0;
    results.push({ category: cat, lines: L, taxCad, excessCredit: schB.next.reduce((a, n) => a + n.amount, 0), scheduleB: needsSchB ? schB : undefined });
    if (schB.cols[0].l6 > 0 && !flags.some((f) => f.id === 'carryback')) flags.push({ id: 'carryback', severity: 'info',
      title: `Unused Canadian tax carries back to ${year - 1} first`,
      detail: `The law applies unused foreign tax to the prior year before carrying it forward. That only matters if you owed US tax on Canadian income in ${year - 1}. If you did, amend ${year - 1} with Form 1040-X to claim it. Otherwise nothing changes; Schedule B (Form 1116) records the carryforward.` });

    // High-tax kickout test for passive income (i1116 line 13; Reg. 1.904-4(c)).
    if (cat === 'passive' && L['7'] > 0 && L['9'] > 0.37 * L['7']) flags.push({ id: 'high-tax-kickout', severity: 'warn',
      title: 'Passive income may be "high-taxed"',
      detail: 'Canadian tax on your investment income is above the top US rate, so it may belong in the general category (Form 1116 line 13). The credit total is usually unaffected; review before filing.' });
  }

  return results;
}

function computeCtc(
  input: ReturnInput, f1040: Record<string, number>, s3: Record<string, number>, feieExcluded: number, files2555: boolean, taxed: IncomeItem[], pficTax = 0,
): Record<string, number> {
  const { year, filingStatus: status } = input;
  const L: Record<string, number> = {};
  const kids = input.dependents.filter((d) => d.usPerson && d.hasValidSsn && d.livedWithYouOverHalfYear && under17(d.dateOfBirth, year)).length;
  const others = input.dependents.filter((d) => d.usPerson && !(d.hasValidSsn && d.livedWithYouOverHalfYear && under17(d.dateOfBirth, year))).length;
  if (kids + others === 0) return L;
  L['1'] = f1040['11a'];
  L['2b'] = feieExcluded;
  L['2d'] = L['2b'];
  L['3'] = L['1'] + L['2d'];
  L['4'] = kids;
  L['5'] = kids * CTC[year].perChild;
  L['6'] = others;
  L['7'] = others * ODC_PER_DEPENDENT;
  L['8'] = L['5'] + L['7'];
  L['9'] = status === 'mfj' ? 400000 : 200000;
  const over = Math.max(0, L['3'] - L['9']);
  L['10'] = over > 0 ? Math.ceil(over / 1000) * 1000 : 0;
  L['11'] = dollars(L['10'] * 0.05);
  if (L['8'] <= L['11']) return L;
  L['12'] = L['8'] - L['11'];
  // Credit Limit Worksheet A: line 18 minus Schedule 3 line 1 (FTC) and other listed credits.
  // Section 1291 tax left out (conservative): Lou doesn't let the child credit offset it.
  L['13'] = Math.max(0, f1040['18'] - pficTax - s3['1']);
  L['14'] = Math.min(L['12'], L['13']);
  // Part II-A: no ACTC when Form 2555 is filed.
  if (files2555 || L['12'] <= L['14']) return L;
  L['16a'] = L['12'] - L['14'];
  L['16b'] = kids * CTC[year].refundablePerChild;
  if (L['16b'] === 0) return L;
  L['17'] = Math.min(L['16a'], L['16b']);
  // Earned Income Worksheet: wages; self-employment income exempt from SE tax is left out (line 2b).
  L['18a'] = dollars(sum(taxed.filter((i) => i.earned && !i.selfEmployment).map((i) => i.usd)));
  L['19'] = Math.max(0, L['18a'] - 2500);
  L['20'] = dollars(L['19'] * 0.15);
  // Part II-B (3+ kids): Canadian wages carry no US social security/Medicare withholding, so line 25 is 0
  // and line 26 = line 20. Result is the same as the 1-2 child path.
  L['27'] = Math.min(L['17'], L['20']);
  return L;
}

function under17(dob: string, year: TaxYear): boolean {
  // Under age 17 at the end of the year: born after Dec 31 of (year - 17).
  return dob > `${year - 17}-12-31`;
}

function computeNiit(status: FilingStatus, f1040: Record<string, number>, feieExcluded: number, pficOrdinary = 0): Record<string, number> {
  const L: Record<string, number> = {};
  const nii = f1040['2b'] + f1040['3b'] + f1040['7a'] + pficOrdinary;
  if (nii <= 0) return L;
  L['8'] = nii;
  L['12'] = nii;
  L['13'] = f1040['11a'] + feieExcluded; // MAGI (line 13 worksheet)
  L['14'] = NIIT_THRESHOLD[status];
  L['15'] = Math.max(0, L['13'] - L['14']);
  L['16'] = Math.min(L['12'], L['15']);
  L['17'] = dollars(L['16'] * 0.038);
  return L;
}

/** Runs both scenarios when FEIE is 'auto' and keeps the one with the larger refund (smaller balance due). */
export function computeReturn(input: ReturnInput): { best: ReturnResult; alternative?: ReturnResult } {
  const ftcOnly = computeScenario(input, false);
  const hasEarned = ftcOnly.items.some((i) => i.earned);
  if (input.elections.feie === 'no' || !hasEarned) return { best: ftcOnly };
  const withFeie = computeScenario(input, true);
  if (input.elections.feie === 'yes') return { best: withFeie, alternative: ftcOnly };
  return withFeie.refund > ftcOnly.refund ? { best: withFeie, alternative: ftcOnly } : { best: ftcOnly, alternative: withFeie };
}
