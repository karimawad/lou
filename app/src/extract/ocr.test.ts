import { describe, expect, it } from 'vitest';
import { mergeSpacedNumbers } from './ocr';

// Photo OCR end to end is covered by template.test.ts.

describe('mergeSpacedNumbers', () => {
  const tok = (text: string, x: number) => ({ text, x, y: 10, w: text.length * 8, h: 12, page: 0 });
  it('joins dollars and cents split by the CRA divider', () => {
    expect(mergeSpacedNumbers([tok('100000.', 0), tok('00', 60)]).map((t) => t.text)).toEqual(['100000.00']);
    expect(mergeSpacedNumbers([tok('4034', 0), tok('10', 40)]).map((t) => t.text)).toEqual(['4034.10']);
  });
  it('joins French thousands groups', () => {
    expect(mergeSpacedNumbers([tok('100', 0), tok('000,00', 28)]).map((t) => t.text)).toEqual(['100 000,00']);
  });
});
