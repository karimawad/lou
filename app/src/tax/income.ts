// Turns confirmed Canadian slips into US income items (USD) plus flags.
// Rules and sources: see CLAUDE.md "Hard-won tax facts" and slips.ts notes.

import { boxDef, DIVIDEND_GROSS_UP } from './slips';
import type { Flag, IncomeItem, ReturnInput, SlipInput } from './model';
import { YEARS } from './years';

/** CAD -> USD at the IRS yearly average rate (divide by CAD per USD), to cents. */
export function cadToUsd(cad: number, cadPerUsd: number): number {
  return Math.round((cad / cadPerUsd) * 100) / 100;
}

export interface IncomeResult {
  items: IncomeItem[];
  flags: Flag[];
  /** Canadian tax withheld per slips (CAD), for the NOA cross-check only. */
  withheldCad: number;
}

const SRC = {
  line1h: 'IRS 2025 Instructions for Form 1040, line 1a (W-2 only) and line 1h; IRS Pub 54',
  schB: 'IRS Instructions for Schedule B; Form 1040 lines 2b/3b',
  pension: 'IRS Pub 597 (RRSP/RRIF payments are pensions); 1040 Instructions: foreign pensions on lines 5a/5b',
  ei: 'Schedule 1 line 7 (unemployment compensation includes foreign government benefits)',
  ss: 'US-Canada treaty Art. XVIII(5), XXIX(2)-(3); AICPA Tax Adviser (Feb 2018)',
  pfic: 'IRC 1291-1298; Instructions for Form 8621',
  category: 'IRC 61(a)(9) vs (11); IRC 904(d)(2)(B)(i), 954(c)(1)(A); Instructions for Form 1116 (passive includes annuities); treaty Art. XVIII(3)',
};

export function buildIncome(input: ReturnInput): IncomeResult {
  const rate = YEARS[input.year].irsAvgCadPerUsd;
  const items: IncomeItem[] = [];
  const flags: Flag[] = [];
  let withheldCad = 0;

  const push = (s: SlipInput, box: string, cad: number, partial: Omit<IncomeItem, 'slipId' | 'slipType' | 'box' | 'owner' | 'cad' | 'usd'> & { usdCad?: number }) => {
    const { usdCad, ...rest } = partial;
    items.push({ slipId: s.id, slipType: s.type, box, owner: s.owner, cad, usd: cadToUsd(usdCad ?? cad, rate), ...rest });
  };

  for (const s of input.slips) {
    const v = (box: string) => s.boxes[box] ?? 0;
    const payer = s.payer || s.type;

    // Every box with a value must be one we know, so nothing is silently dropped.
    for (const [box, amount] of Object.entries(s.boxes)) {
      if (!amount) continue;
      const def = boxDef(s.type, box);
      if (!def) {
        flags.push({ id: `unknown-${s.id}-${box}`, severity: 'block', slipId: s.id, box,
          title: `${s.type} box ${box} isn't in Lou's catalog`,
          detail: 'Check the box number. If it is correct, this amount needs review before filing.' });
      } else if (def.treatment === 'canadianTaxInfo') {
        withheldCad += amount;
      }
    }

    switch (s.type) {
      case 'T4': {
        if (v('14')) push(s, '14', v('14'), {
          description: `Foreign employer compensation - ${payer} (T4)`, usLine: '1h', category: 'general',
          earned: true, qualifiedDividend: false, canadianTaxableCad: v('14'), sources: [SRC.line1h],
        });
        for (const box of ['66', '67']) if (v(box)) {
          push(s, box, v(box), {
            description: `Retiring allowance - ${payer} (T4 box ${box})`, usLine: '1h', category: 'general',
            earned: true, qualifiedDividend: false, canadianTaxableCad: v(box), sources: [SRC.line1h],
          });
          flags.push({ id: `retiring-${s.id}-${box}`, severity: 'warn', slipId: s.id, box,
            title: 'Severance pay included as wages',
            detail: 'Retiring allowances are taxable in the US. If part was rolled into an RRSP, the US still taxes it now. Whether it counts as foreign earned income depends on when you did the work.' });
        }
        if (v('20')) flags.push({ id: `rpp-${s.id}`, severity: 'info', slipId: s.id, box: '20',
          title: 'Pension plan contributions not deducted',
          detail: 'Your RPP contributions are taxed by the US by default. The treaty (Art. XVIII(13)) can allow a deduction for employer pension plans, filed with Form 8833. Lou does not claim it automatically.' });
        if (v('38')) flags.push({ id: `options-${s.id}`, severity: 'warn', slipId: s.id, box: '38',
          title: 'Stock option benefit on your T4',
          detail: 'It is already in box 14. US rules can time stock option income differently than Canada (for example, at vesting or sale). Check with your plan documents.' });
        break;
      }
      case 'T5': {
        const fund = s.answers?.dividendSource === 'fund';
        const qualified = s.answers?.dividendSource === 'company' && s.answers?.metHoldingPeriod !== false;
        if (!s.answers?.dividendSource && (v('24') || v('10') || v('18'))) {
          flags.push({ id: `divsrc-${s.id}`, severity: 'warn', slipId: s.id,
            title: `Are ${payer}'s dividends from a company or a fund?`,
            detail: 'Dividends from Canadian company shares can be "qualified" and taxed at lower US rates. Fund distributions cannot, and funds bring PFIC rules. Until you answer, Lou uses the higher-tax treatment.' });
        }
        if (v('13') || v('30')) push(s, v('13') ? '13' : '30', v('13') + v('30'), {
          description: `Interest - ${payer} (T5)`, usLine: '2b', category: 'passive', earned: false,
          qualifiedDividend: false, canadianTaxableCad: v('13') + v('30'), sources: [SRC.schB],
        });
        if (v('24')) push(s, '24', v('24'), {
          description: `Eligible dividends - ${payer} (T5)`, usLine: '3b', category: 'passive', earned: false,
          qualifiedDividend: qualified, canadianTaxableCad: v('24') * DIVIDEND_GROSS_UP.eligible, sources: [SRC.schB],
        });
        if (v('10')) push(s, '10', v('10'), {
          description: `Other dividends - ${payer} (T5)`, usLine: '3b', category: 'passive', earned: false,
          qualifiedDividend: qualified, canadianTaxableCad: v('10') * DIVIDEND_GROSS_UP.other, sources: [SRC.schB],
        });
        if (v('18')) push(s, '18', v('18'), fund
          ? { description: `Fund capital gains dividend - ${payer} (T5)`, usLine: '3b', category: 'passive', earned: false,
              qualifiedDividend: false, canadianTaxableCad: v('18') / 2, sources: [SRC.pfic] }
          : { description: `Capital gain distribution - ${payer} (T5)`, usLine: 'sd_13', category: 'passive', earned: false,
              qualifiedDividend: false, canadianTaxableCad: v('18') / 2, sources: [SRC.schB] });
        if (fund) flags.push(pficFlag(s));
        for (const box of ['14', '15', '16', '17', '19']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
      }
      case 'T3': {
        // T3 issuers are almost always mutual fund trusts/ETFs: PFICs. Under the default
        // section 1291 regime, distributions that are not "excess" are ordinary income.
        const ordinary = v('49') + v('23') + v('26');
        const gains = v('21');
        if (ordinary || gains) {
          push(s, '49', ordinary + gains, {
            description: `Fund distributions - ${payer} (T3)`, usLine: '3b', category: 'passive', earned: false,
            qualifiedDividend: false,
            canadianTaxableCad: v('49') * DIVIDEND_GROSS_UP.eligible + v('23') * DIVIDEND_GROSS_UP.other + v('26') + gains / 2,
            sources: [SRC.pfic],
          });
          flags.push(pficFlag(s));
        }
        pushPensionParts(s, [{ box: '31', cad: v('22') + v('31'), description: `Pension income - ${payer} (T3)`, category: 'general' }]);
        for (const box of ['25', '34']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
      }
      case 'T4A': {
        pushPensionParts(s, [
          { box: '016', cad: v('016') + v('018'), description: `Pension - ${payer} (T4A)`, category: 'general' },
          { box: '024', cad: v('024'), description: `Annuity - ${payer} (T4A)`, category: 'passive' },
        ]);
        if (v('028')) push(s, '028', v('028'), {
          description: `Other income - ${payer} (T4A)`, usLine: 's1_8z', category: 'general', earned: false,
          qualifiedDividend: false, canadianTaxableCad: v('028'), sources: ['Schedule 1 line 8z'],
        });
        // Self-employment amounts belong on Schedule C: fine once the person has a business entered.
        const hasBusiness = (input.businesses ?? []).some((b) => b.owner === s.owner);
        for (const box of ['020', '048']) if (v(box)) flags.push(hasBusiness
          ? { id: `t4a-se-${s.id}-${box}`, severity: 'info', slipId: s.id, box, title: `T4A box ${box} is self-employment income`,
              detail: 'Lou assumes it is included in the gross income of your business (Schedule C) and does not count it again. If it is not, add it there.' }
          : reviewFlag(s, box));
        for (const box of ['105', '107', '119', '134']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
      }
      case 'T4RSP': {
        pushPensionParts(s, [
          { box: '22', cad: v('18') + v('20') + v('22') + v('26') + v('34'), description: `RRSP payment - ${payer} (T4RSP)`, category: 'general' },
          { box: '16', cad: v('16'), description: `RRSP annuity - ${payer} (T4RSP)`, category: 'passive' },
        ]);
        for (const box of ['25', '27', '28']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
      }
      case 'T4RIF': {
        pushPensionParts(s, [{ box: '16', cad: v('16') + v('18') + v('20'), description: `RRIF payment - ${payer} (T4RIF)`, category: 'general' }]);
        if (v('22')) flags.push(reviewFlag(s, '22'));
        break;
      }
      case 'T4E': {
        if (v('14')) push(s, '14', v('14'), {
          description: 'Employment Insurance benefits (T4E)', usLine: 's1_7', category: 'general', earned: false,
          qualifiedDividend: false, canadianTaxableCad: v('14'), sources: [SRC.ei],
        });
        for (const box of ['20', '21']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
      }
      case 'T4AP':
      case 'T4AOAS': {
        const box = s.type === 'T4AP' ? '20' : '18';
        const label = s.type === 'T4AP' ? 'Canada Pension Plan benefits (T4A(P))' : 'Old Age Security (T4A(OAS))';
        if (v(box)) {
          const exempt = input.elections.canadianSocialSecurityExempt;
          push(s, box, v(box), {
            description: label, usLine: exempt ? 'excluded' : 's1_8z', category: 'general', earned: false,
            qualifiedDividend: false, canadianTaxableCad: v(box), sources: [SRC.ss],
          });
          flags.push({ id: `ss-${s.id}`, severity: 'info', slipId: s.id, box,
            title: exempt ? 'CPP/OAS treated as exempt from US tax (Form 8833)' : 'CPP/OAS included in US income',
            detail: exempt
              ? 'Most cross-border professionals treat CPP, QPP and OAS paid to a US citizen living in Canada as taxable only in Canada, and disclose that position on Form 8833. Lou does this by default. The treaty wording is not airtight on this point, so you can switch to including it.'
              : 'You chose to include CPP/OAS in US income. Canadian tax on it is still available for the foreign tax credit.' });
        }
        break;
      }
      case 'T5008':
        // Fine once its sales are entered with dates (sales list, linked by slip).
        if ((v('20') || v('21')) && !(input.sales ?? []).some((x) => x.slipId === s.id && x.acquired && x.sold)) flags.push({ id: `t5008-${s.id}`, severity: 'block', slipId: s.id,
          title: 'Securities sales need dates and per-trade exchange rates',
          detail: 'US capital gains use the exchange rate on the day you bought and the day you sold, not the yearly average. Add the purchase and sale dates for each sale ("Sales of investments" on the questions step) so Lou can fill Form 8949.' });
        break;
      case 'T5007':
        for (const box of ['10', '11']) if (v(box)) flags.push(reviewFlag(s, box));
        break;
    }
  }

  /**
   * Pensions and RRSP/RRIF withdrawals go in the general category: IRC 61(a) separates "annuities"
   * (9) from "pensions" (11), and passive income under 904(d)(2)(B)/954(c) covers annuities only.
   * Boxes that are true annuity payments (T4A 024, T4RSP 16) are passive. One US basis answer per
   * slip is shared across its parts in proportion to their amounts.
   */
  function pushPensionParts(s: SlipInput, parts: { box: string; cad: number; description: string; category: 'general' | 'passive' }[]) {
    const live = parts.filter((p) => p.cad > 0);
    if (!live.length) return;
    const total = live.reduce((acc, p) => acc + p.cad, 0);
    const basis = Math.min(total, Math.max(0, s.answers?.usBasisCad ?? 0));
    for (const p of live) {
      const share = basis * (p.cad / total);
      push(s, p.box, p.cad, {
        description: p.description, usLine: '5b', category: p.category, earned: false, qualifiedDividend: false,
        canadianTaxableCad: p.cad, sources: [SRC.pension, SRC.category], usdCad: p.cad - share,
      });
    }
    if (s.answers?.usBasisCad === undefined) flags.push({ id: `basis-${s.id}`, severity: 'warn', slipId: s.id, box: live[0].box,
      title: 'US basis in this plan',
      detail: 'If you put money in while a US person and did not deduct it on a US return, that part comes out US tax-free. Lou assumes zero basis (fully taxable) until you enter it.' });
    if (['T4RSP', 'T4RIF'].includes(s.type) && !flags.some((f) => f.id === 'rrsp-category')) flags.push({ id: 'rrsp-category', severity: 'info',
      title: 'RRSP and RRIF withdrawals are in the general category of Form 1116',
      detail: 'The treaty treats these as pensions, and US law puts pensions (unlike annuities) outside passive income. This is the position most cross-border professionals take, though no IRS ruling addresses RRSPs by name. Annuity payments bought with RRSP money go in the passive category.' });
  }

  return { items, flags, withheldCad };
}

function pficFlag(s: SlipInput): Flag {
  return {
    id: `pfic-${s.id}`, severity: 'warn', slipId: s.id,
    title: `${s.payer || s.type} looks like a fund (PFIC)`,
    detail: 'Canadian mutual funds and ETFs are PFICs for US tax. Distributions are taxed as ordinary income and Form 8621 may be required unless the fund is held inside an RRSP or RRIF. Lou flags this so it is not missed.',
  };
}

function reviewFlag(s: SlipInput, box: string): Flag {
  const def = boxDef(s.type, box);
  return {
    id: `review-${s.id}-${box}`, severity: 'block', slipId: s.id, box,
    title: `${s.type} box ${box}: ${def?.label ?? 'needs review'}`,
    detail: `${def?.note ? def.note + ' ' : ''}Lou can't place this amount automatically. It is listed in your mapping guide for manual entry.`,
  };
}
