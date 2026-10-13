import {
  availableOf,
  balanceAsOf,
  balanceHistory,
  balanceOf,
  costSummary,
  inUseSince,
  overdraftPayoff,
  overdraftStatus,
  peakBalanceSinceInUse,
  percentCleared,
  projectedMonthlyInterest,
  usageTransition,
  usedPercent,
} from '../overdraftMath';
import type { OverdraftEvent, OverdraftEventType } from '../types';

let nextId = 1;
function ev(
  type: OverdraftEventType,
  amount: number,
  date: Date,
  overrides: Partial<OverdraftEvent> = {},
): OverdraftEvent {
  return {
    id: `e-${nextId++}`,
    type,
    amount,
    date,
    note: null,
    transactionId: null,
    createdAt: date,
    ...overrides,
  };
}

// Local dates, matching how the rest of the app buckets by calendar month
// (spec 000 — rigid calendar month).
const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('balanceOf / availableOf / usedPercent (spec 012 criterion 2)', () => {
  it('is 0 with no events', () => {
    expect(balanceOf([])).toBe(0);
  });

  it('adds draws, interest and fees, and subtracts payments', () => {
    const events = [
      ev('draw', 1000000, d(2026, 4, 9)),
      ev('interest', 20000, d(2026, 5, 1)),
      ev('fee', 5000, d(2026, 5, 1)),
      ev('payment', 300000, d(2026, 5, 10)),
    ];
    expect(balanceOf(events)).toBe(725000);
  });

  it('computes available = limit − balance, negative when over the limit', () => {
    expect(availableOf(1240000, 2000000)).toBe(760000);
    expect(availableOf(2120000, 2000000)).toBe(-120000);
  });

  it('computes usedPercent as a whole number, above 100 when over the limit', () => {
    expect(usedPercent(1240000, 2000000)).toBe(62);
    expect(usedPercent(2120000, 2000000)).toBe(106);
    expect(usedPercent(0, 2000000)).toBe(0);
  });

  it('treats a zero limit as 0% instead of dividing by zero', () => {
    expect(usedPercent(500000, 0)).toBe(0);
  });
});

describe('overdraftStatus (criterion 3 — exact boundaries at a 2.000.000 limit)', () => {
  const LIMIT = 2000000;

  it('is unused at a zero balance', () => {
    expect(overdraftStatus(0, LIMIT)).toBe('unused');
  });

  it('is in-use just below 75%', () => {
    expect(overdraftStatus(1, LIMIT)).toBe('in-use');
    expect(overdraftStatus(1499999, LIMIT)).toBe('in-use');
  });

  it('is high from exactly 75% up to and including the limit', () => {
    expect(overdraftStatus(1500000, LIMIT)).toBe('high');
    expect(overdraftStatus(2000000, LIMIT)).toBe('high');
  });

  it('is over-limit above the limit', () => {
    expect(overdraftStatus(2000001, LIMIT)).toBe('over-limit');
  });
});

describe('inUseSince (criterion 4)', () => {
  it('is null with no events', () => {
    expect(inUseSince([])).toBeNull();
  });

  it('is the date of the draw that took the balance above zero', () => {
    expect(inUseSince([ev('draw', 100000, d(2026, 4, 9))])).toEqual(d(2026, 4, 9));
  });

  it('stays at the first draw while the balance never returns to zero', () => {
    const events = [
      ev('draw', 100000, d(2026, 4, 9)),
      ev('draw', 50000, d(2026, 4, 20)),
      ev('payment', 30000, d(2026, 5, 2)),
    ];
    expect(inUseSince(events)).toEqual(d(2026, 4, 9));
  });

  it('is cleared (null) once the balance returns to exactly zero', () => {
    const events = [ev('draw', 100000, d(2026, 4, 9)), ev('payment', 100000, d(2026, 5, 1))];
    expect(inUseSince(events)).toBeNull();
  });

  it('restarts on the next draw after being cleared', () => {
    const events = [
      ev('draw', 100000, d(2026, 4, 9)),
      ev('payment', 100000, d(2026, 5, 1)),
      ev('draw', 80000, d(2026, 6, 3)),
    ];
    expect(inUseSince(events)).toEqual(d(2026, 6, 3));
  });

  it('does not depend on the order events are passed in', () => {
    const events = [
      ev('draw', 80000, d(2026, 6, 3)),
      ev('payment', 100000, d(2026, 5, 1)),
      ev('draw', 100000, d(2026, 4, 9)),
    ];
    expect(inUseSince(events)).toEqual(d(2026, 6, 3));
  });

  it('breaks same-day ties by createdAt, so a draw logged before its same-day payment is replayed first', () => {
    const day = d(2026, 5, 1, 0);
    const events = [
      ev('payment', 100000, day, { createdAt: new Date(2026, 4, 1, 15) }),
      ev('draw', 100000, day, { createdAt: new Date(2026, 4, 1, 9) }),
    ];
    // draw (09:00) then payment (15:00) → back to zero, not in use.
    expect(inUseSince(events)).toBeNull();
  });
});

describe('peakBalanceSinceInUse / percentCleared (road to zero)', () => {
  const events = [
    ev('draw', 200000, d(2026, 4, 9)),
    ev('draw', 700000, d(2026, 5, 3)),
    ev('draw', 700000, d(2026, 6, 10)), // 1.600.000 — the peak
    ev('payment', 300000, d(2026, 7, 5)),
    ev('draw', 200000, d(2026, 8, 2)),
    ev('payment', 260000, d(2026, 9, 4)), // 1.240.000
  ];

  it('is the highest balance reached during the current use', () => {
    expect(peakBalanceSinceInUse(events)).toBe(1600000);
  });

  it('forgets earlier uses once the balance has returned to zero', () => {
    const cleared = [
      ev('draw', 500000, d(2026, 1, 5)),
      ev('payment', 500000, d(2026, 2, 5)),
      ev('draw', 100000, d(2026, 3, 5)),
    ];
    expect(peakBalanceSinceInUse(cleared)).toBe(100000);
  });

  it('is 0 when unused', () => {
    expect(peakBalanceSinceInUse([])).toBe(0);
  });

  it('computes percentCleared as 1 − balance / peak', () => {
    expect(percentCleared(1240000, 1600000)).toBeCloseTo(0.225, 5);
  });

  it('is 100% cleared at a zero balance, including when there is no peak', () => {
    expect(percentCleared(0, 1600000)).toBe(1);
    expect(percentCleared(0, 0)).toBe(1);
  });
});

describe('costSummary (criterion 8 — from logged events only, calendar month)', () => {
  const now = d(2026, 9, 25);

  it('sums this calendar month’s interest and fees separately, and all-time cost', () => {
    const events = [
      ev('interest', 20000, d(2026, 8, 10)),
      ev('interest', 23560, d(2026, 9, 10)),
      ev('fee', 4990, d(2026, 9, 10)),
      ev('draw', 900000, d(2026, 9, 3)), // not a cost
      ev('payment', 100000, d(2026, 9, 4)), // not a cost
    ];
    expect(costSummary(events, now)).toEqual({
      interestThisMonth: 23560,
      feesThisMonth: 4990,
      totalCost: 48550,
    });
  });

  it('puts the first instant of the month in the month, and the last instant of the previous one out', () => {
    const events = [
      ev('interest', 1000, new Date(2026, 8, 1, 0, 0, 0)),
      ev('interest', 2000, new Date(2026, 7, 31, 23, 59, 59)),
    ];
    expect(costSummary(events, now).interestThisMonth).toBe(1000);
  });

  it('is all zeros with no events', () => {
    expect(costSummary([], now)).toEqual({ interestThisMonth: 0, feesThisMonth: 0, totalCost: 0 });
  });
});

describe('projectedMonthlyInterest (criterion 8)', () => {
  it('is balance × monthly rate %, rounded to whole CLP', () => {
    expect(projectedMonthlyInterest(1240000, 1.9)).toBe(23560);
    expect(projectedMonthlyInterest(100001, 1.9)).toBe(1900);
    expect(projectedMonthlyInterest(1000, 1.5)).toBe(15);
  });

  it('is 0 for a zero balance or a zero rate', () => {
    expect(projectedMonthlyInterest(0, 1.9)).toBe(0);
    expect(projectedMonthlyInterest(1240000, 0)).toBe(0);
  });

  it('is unknown (null), not 0, when the rate is unknown (amendment, criterion 17)', () => {
    expect(projectedMonthlyInterest(1240000, null)).toBeNull();
    expect(projectedMonthlyInterest(0, null)).toBeNull();
    // A real 0% rate is still a known zero.
    expect(projectedMonthlyInterest(1240000, 0)).toBe(0);
  });
});

describe('overdraftPayoff (criterion 9)', () => {
  it('is done at a zero balance', () => {
    expect(overdraftPayoff(0, 1.9, 300000)).toEqual({ kind: 'done' });
  });

  it('asks for a planned payment when none is set', () => {
    expect(overdraftPayoff(1240000, 1.9, null)).toEqual({ kind: 'no-plan' });
  });

  it('says the payment does not cover the interest when P ≤ B·r (including exactly equal)', () => {
    expect(overdraftPayoff(1240000, 1.9, 23560)).toEqual({ kind: 'not-covering' });
    expect(overdraftPayoff(1240000, 1.9, 20000)).toEqual({ kind: 'not-covering' });
  });

  it('is ⌈B/P⌉ months with no remaining interest at a zero rate', () => {
    expect(overdraftPayoff(900000, 0, 300000)).toEqual({
      kind: 'clears',
      months: 3,
      remainingInterest: 0,
    });
    expect(overdraftPayoff(900000, 0, 250000)).toEqual({
      kind: 'clears',
      months: 4,
      remainingInterest: 0,
    });
  });

  it('amortizes at a monthly rate: months rounded up, interest from the unrounded month count', () => {
    // n′ = −ln(1 − r·B/P) / ln(1 + r) = 4.3454… → 5 months;
    // remaining interest = round(P·n′ − B) = 63.630
    expect(overdraftPayoff(1240000, 1.9, 300000)).toEqual({
      kind: 'clears',
      months: 5,
      remainingInterest: 63630,
    });
    expect(overdraftPayoff(1240000, 1.9, 400000)).toEqual({
      kind: 'clears',
      months: 4,
      remainingInterest: 50122,
    });
  });

  it('gives an interest-free lower bound of ⌈B/P⌉ months when the rate is unknown (amendment, criterion 18)', () => {
    expect(overdraftPayoff(1240000, null, 300000)).toEqual({ kind: 'at-least', months: 5 });
    expect(overdraftPayoff(900000, null, 300000)).toEqual({ kind: 'at-least', months: 3 });
  });

  it('never warns the payment does not cover the interest while the rate is unknown', () => {
    expect(overdraftPayoff(1240000, null, 20000)).toEqual({ kind: 'at-least', months: 62 });
  });

  it('still asks for a planned payment, or is done, when the rate is unknown', () => {
    expect(overdraftPayoff(1240000, null, null)).toEqual({ kind: 'no-plan' });
    expect(overdraftPayoff(0, null, 300000)).toEqual({ kind: 'done' });
  });

  it('clears in one month when the payment covers the balance plus a month of interest', () => {
    expect(overdraftPayoff(100000, 1.9, 200000)).toEqual({
      kind: 'clears',
      months: 1,
      remainingInterest: 1430,
    });
  });
});

describe('usageTransition (criterion 10 — which confirmation a draw earns)', () => {
  const LIMIT = 2000000;

  it('is started when the balance goes from 0 to above 0', () => {
    expect(usageTransition(0, 180000, LIMIT)).toBe('started');
  });

  it('is crossed-high when the balance first reaches 75%', () => {
    expect(usageTransition(1400000, 1520000, LIMIT)).toBe('crossed-high');
    expect(usageTransition(1499999, 1500000, LIMIT)).toBe('crossed-high');
  });

  it('is crossed-limit when the balance first exceeds the limit', () => {
    expect(usageTransition(1900000, 2100000, LIMIT)).toBe('crossed-limit');
  });

  it('reports the most severe threshold when one draw crosses several', () => {
    expect(usageTransition(0, 1600000, LIMIT)).toBe('crossed-high');
    expect(usageTransition(0, 2200000, LIMIT)).toBe('crossed-limit');
    expect(usageTransition(1400000, 2100000, LIMIT)).toBe('crossed-limit');
  });

  it('is null when nothing new was crossed', () => {
    expect(usageTransition(300000, 400000, LIMIT)).toBeNull();
    expect(usageTransition(1600000, 1700000, LIMIT)).toBeNull();
    expect(usageTransition(2100000, 2200000, LIMIT)).toBeNull();
  });

  it('is null when the balance did not go up', () => {
    expect(usageTransition(1600000, 1200000, LIMIT)).toBeNull();
    expect(usageTransition(0, 0, LIMIT)).toBeNull();
  });
});

describe('balanceHistory (criterion 11 — 6 month-end balances, oldest first)', () => {
  const now = d(2026, 9, 25);

  it('returns the balance at the end of each of the last six calendar months', () => {
    const events = [
      ev('draw', 200000, d(2026, 4, 9)),
      ev('draw', 700000, d(2026, 5, 3)),
      ev('draw', 700000, d(2026, 6, 10)),
      ev('payment', 300000, d(2026, 7, 5)),
      ev('draw', 200000, d(2026, 8, 2)),
      ev('payment', 260000, d(2026, 9, 4)),
    ];
    expect(balanceHistory(events, now)).toEqual([
      { year: 2026, month: 4, balance: 200000 },
      { year: 2026, month: 5, balance: 900000 },
      { year: 2026, month: 6, balance: 1600000 },
      { year: 2026, month: 7, balance: 1300000 },
      { year: 2026, month: 8, balance: 1500000 },
      { year: 2026, month: 9, balance: 1240000 },
    ]);
  });

  it('carries events from before the window into every month of it', () => {
    const history = balanceHistory([ev('draw', 100000, d(2026, 3, 1))], now);
    expect(history).toHaveLength(6);
    expect(history.every((p) => p.balance === 100000)).toBe(true);
  });

  it('ignores events dated after now', () => {
    const history = balanceHistory([ev('draw', 100000, d(2026, 9, 26))], now);
    expect(history[5]).toEqual({ year: 2026, month: 9, balance: 0 });
  });

  it('is six zeros with no events, and spans a year boundary correctly', () => {
    const history = balanceHistory([], d(2026, 2, 10));
    expect(history.map((p) => `${p.year}-${p.month}`)).toEqual([
      '2025-9',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-1',
      '2026-2',
    ]);
    expect(history.every((p) => p.balance === 0)).toBe(true);
  });
});

describe('balanceAsOf (spec 012 criterion 25 — balance at the end of a month)', () => {
  const aug = { year: 2026, month: 8 };

  it('replays only events dated on or before the last day of the month', () => {
    const events = [
      ev('draw', 500000, d(2026, 8, 10)),
      ev('payment', 100000, d(2026, 8, 31, 23)),
      ev('draw', 300000, d(2026, 9, 1, 0)),
      ev('interest', 9000, d(2026, 10, 2)),
    ];
    expect(balanceAsOf(events, aug)).toBe(400000);
  });

  it('is null when no event is dated on or before the month (line not in use yet)', () => {
    expect(balanceAsOf([ev('draw', 500000, d(2026, 9, 2))], aug)).toBeNull();
    expect(balanceAsOf([], aug)).toBeNull();
  });

  it('is 0, not null, when events exist but net to zero by month end', () => {
    const events = [ev('draw', 200000, d(2026, 7, 3)), ev('payment', 200000, d(2026, 8, 5))];
    expect(balanceAsOf(events, aug)).toBe(0);
  });

  it('equals balanceOf when no event is dated after the month', () => {
    const events = [ev('draw', 200000, d(2026, 7, 3)), ev('fee', 1000, d(2026, 8, 5))];
    expect(balanceAsOf(events, aug)).toBe(balanceOf(events));
  });
});
