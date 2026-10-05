import { describe, expect, it } from 'vitest';
import { dailyRate } from './fx';

describe('Bank of Canada daily rates', () => {
  it('reads a business day', () => expect(dailyRate('2025-12-31')).toEqual({ rate: 1.3706, on: '2025-12-31' }));
  it('uses the last business day before a weekend or holiday', () => {
    expect(dailyRate('2023-12-31')).toEqual({ rate: 1.3226, on: '2023-12-29' }); // Sunday -> Friday
    expect(dailyRate('2017-01-01')?.on).toBe('2016-12-30'); // noon-rate series before 2017
  });
  it('is null outside the bundled range', () => {
    expect(dailyRate('2006-03-01')).toBeNull();
    expect(dailyRate('not a date')).toBeNull();
  });
});
