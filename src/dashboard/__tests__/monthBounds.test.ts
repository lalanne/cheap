import { startOfNextMonth } from '../monthBounds';

describe('startOfNextMonth (spec 009 amendment 2026-10-10 — exclusive month-end bound)', () => {
  it('returns local midnight on the 1st of the following month (1-indexed month)', () => {
    expect(startOfNextMonth({ year: 2026, month: 8 })).toEqual(new Date(2026, 8, 1));
  });

  it('rolls December over into January of the next year', () => {
    expect(startOfNextMonth({ year: 2026, month: 12 })).toEqual(new Date(2027, 0, 1));
  });
});
