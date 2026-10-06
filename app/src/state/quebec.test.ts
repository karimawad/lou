import { describe, expect, it } from 'vitest';
import { looksQuebec } from './quebec';
import { initialState, type SlipRecord } from './store';

const slip = (over: Partial<SlipRecord>): SlipRecord => ({ id: 'x', type: 'T4', owner: 'taxpayer', payer: 'Co', boxes: {}, reads: {}, edited: [], confirmed: true, ...over });

describe('Quebec is stopped, not guessed', () => {
  it('stops a Quebec address, QPP or QPIP on a T4, or Quebec tax on the assessment', () => {
    const base = initialState();
    expect(looksQuebec(base)).toBe(false);
    expect(looksQuebec({ ...base, address: { ...base.address, province: 'QC' } })).toBe(true);
    expect(looksQuebec({ ...base, slips: [slip({ boxes: { '17': 500 } })] })).toBe(true);
    expect(looksQuebec({ ...base, slips: [slip({ boxes: { '55': 300 } })] })).toBe(true);
    expect(looksQuebec({ ...base, slips: [slip({ type: 'NOA', boxes: { QC432: 9000 } })] })).toBe(true);
    // Box 17 on a T5 is something else.
    expect(looksQuebec({ ...base, slips: [slip({ type: 'T5', boxes: { '17': 500 } })] })).toBe(false);
    expect(looksQuebec({ ...base, address: { ...base.address, province: 'ON' }, slips: [slip({ boxes: { '14': 90000, '16': 3000 } })] })).toBe(false);
  });
});
