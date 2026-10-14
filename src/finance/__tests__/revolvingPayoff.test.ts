import { projectedMonthlyInterest, revolvingPayoff } from '../revolvingPayoff';

// Extracted from spec 012's overdraftMath.ts (spec 013, "Why not spec
// 008's Debt" / Derived values) so overdraft and credit cards share one
// implementation of the same math instead of two that can drift. These
// cases mirror overdraftMath.test.ts's own payoff/interest coverage
// exactly — spec 012's tests keep passing unchanged against its
// re-exported names, proving the extraction didn't change behavior.

describe('projectedMonthlyInterest', () => {
  it('is balance × monthly rate %, rounded to whole CLP', () => {
    expect(projectedMonthlyInterest(1240000, 1.9)).toBe(23560);
    expect(projectedMonthlyInterest(100001, 1.9)).toBe(1900);
    expect(projectedMonthlyInterest(1000, 1.5)).toBe(15);
  });

  it('is 0 for a zero balance or a zero rate', () => {
    expect(projectedMonthlyInterest(0, 1.9)).toBe(0);
    expect(projectedMonthlyInterest(1240000, 0)).toBe(0);
  });

  it('is unknown (null), not 0, when the rate is unknown', () => {
    expect(projectedMonthlyInterest(1240000, null)).toBeNull();
    expect(projectedMonthlyInterest(0, null)).toBeNull();
    expect(projectedMonthlyInterest(1240000, 0)).toBe(0);
  });
});

describe('revolvingPayoff', () => {
  it('is done at a zero balance', () => {
    expect(revolvingPayoff(0, 1.9, 300000)).toEqual({ kind: 'done' });
  });

  it('asks for a planned payment when none is set', () => {
    expect(revolvingPayoff(1240000, 1.9, null)).toEqual({ kind: 'no-plan' });
  });

  it('says the payment does not cover the interest when P ≤ B·r (including exactly equal)', () => {
    expect(revolvingPayoff(1240000, 1.9, 23560)).toEqual({ kind: 'not-covering' });
    expect(revolvingPayoff(1240000, 1.9, 20000)).toEqual({ kind: 'not-covering' });
  });

  it('is ⌈B/P⌉ months with no remaining interest at a zero rate', () => {
    expect(revolvingPayoff(900000, 0, 300000)).toEqual({
      kind: 'clears',
      months: 3,
      remainingInterest: 0,
    });
    expect(revolvingPayoff(900000, 0, 250000)).toEqual({
      kind: 'clears',
      months: 4,
      remainingInterest: 0,
    });
  });

  it('amortizes at a monthly rate: months rounded up, interest from the unrounded month count', () => {
    expect(revolvingPayoff(1240000, 1.9, 300000)).toEqual({
      kind: 'clears',
      months: 5,
      remainingInterest: 63630,
    });
    expect(revolvingPayoff(1240000, 1.9, 400000)).toEqual({
      kind: 'clears',
      months: 4,
      remainingInterest: 50122,
    });
  });

  it('gives an interest-free lower bound of ⌈B/P⌉ months when the rate is unknown', () => {
    expect(revolvingPayoff(1240000, null, 300000)).toEqual({ kind: 'at-least', months: 5 });
    expect(revolvingPayoff(900000, null, 300000)).toEqual({ kind: 'at-least', months: 3 });
  });

  it('never warns the payment does not cover the interest while the rate is unknown', () => {
    expect(revolvingPayoff(1240000, null, 20000)).toEqual({ kind: 'at-least', months: 62 });
  });

  it('still asks for a planned payment, or is done, when the rate is unknown', () => {
    expect(revolvingPayoff(1240000, null, null)).toEqual({ kind: 'no-plan' });
    expect(revolvingPayoff(0, null, 300000)).toEqual({ kind: 'done' });
  });

  it('clears in one month when the payment covers the balance plus a month of interest', () => {
    expect(revolvingPayoff(100000, 1.9, 200000)).toEqual({
      kind: 'clears',
      months: 1,
      remainingInterest: 1430,
    });
  });
});
