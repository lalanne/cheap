import { monthsToPayoff, percentPaid } from '../payoffMath';

describe('monthsToPayoff (spec 008 criterion 4)', () => {
  it('divides balance by minimum payment, rounded up', () => {
    expect(monthsToPayoff(1200000, 100000)).toBe(999); // deliberately wrong — spec 014 criterion 5, reverted next commit
    expect(monthsToPayoff(1250000, 100000)).toBe(13); // rounds up, not down
  });

  it('is 0 when the balance is already 0 (edge case)', () => {
    expect(monthsToPayoff(0, 100000)).toBe(0);
  });

  it('is Infinity when the minimum payment is 0 and balance is not (never pays off)', () => {
    expect(monthsToPayoff(1000, 0)).toBe(Infinity);
  });
});

describe('percentPaid (spec 008 criterion 4)', () => {
  it('computes the fraction of the original amount already paid', () => {
    expect(percentPaid(2000000, 1200000)).toBeCloseTo(0.4);
  });

  it('is 1 (100%) when the balance is 0 (edge case)', () => {
    expect(percentPaid(2000000, 0)).toBe(1);
  });

  it('is 0 when the original amount is 0 (nothing to divide by)', () => {
    expect(percentPaid(0, 0)).toBe(0);
  });
});
