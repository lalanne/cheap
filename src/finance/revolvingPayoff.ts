// Shared by spec 012 (overdraft) and spec 013 (credit cards): the payoff
// estimate and carrying cost for a revolving balance (one that both rises
// with new charges and falls with payments), as opposed to spec 008's
// simple, monotonically-decreasing loan model. Extracted from
// src/overdraft/overdraftMath.ts, which now re-exports these under its
// own names — its behavior and tests are unchanged.

// null when the rate is unknown — deliberately not 0, so the UI can ask for
// the rate instead of claiming the balance costs nothing to carry.
export function projectedMonthlyInterest(balance: number, monthlyRate: number | null): number | null {
  if (monthlyRate === null) {
    return null;
  }
  if (balance <= 0 || monthlyRate <= 0) {
    return 0;
  }
  return Math.round((balance * monthlyRate) / 100);
}

export type RevolvingPayoff =
  | { kind: 'done' }
  | { kind: 'no-plan' }
  | { kind: 'not-covering' }
  // Rate unknown: interest can't be estimated, so this is an interest-free
  // lower bound, ⌈B/P⌉ months.
  | { kind: 'at-least'; months: number }
  | { kind: 'clears'; months: number; remainingInterest: number };

// Deliberately not spec 008's simple balance/minimumPayment estimate —
// interest is the point for a revolving balance, so this one accounts for
// it: n = −ln(1 − r·B/P) / ln(1 + r) months, paying P at each month's end
// after that month's interest. Interest is P·n′ − B from the *unrounded*
// n′ (rounding first would overstate it — the last payment is smaller
// than P).
export function revolvingPayoff(
  balance: number,
  monthlyRate: number | null,
  plannedPayment: number | null
): RevolvingPayoff {
  if (balance <= 0) {
    return { kind: 'done' };
  }
  if (plannedPayment === null || plannedPayment <= 0) {
    return { kind: 'no-plan' };
  }
  if (monthlyRate === null) {
    return { kind: 'at-least', months: Math.ceil(balance / plannedPayment) };
  }
  const r = monthlyRate / 100;
  if (r <= 0) {
    return { kind: 'clears', months: Math.ceil(balance / plannedPayment), remainingInterest: 0 };
  }
  if (plannedPayment <= balance * r) {
    return { kind: 'not-covering' };
  }
  const exactMonths = -Math.log(1 - (r * balance) / plannedPayment) / Math.log(1 + r);
  return {
    kind: 'clears',
    months: Math.ceil(exactMonths),
    remainingInterest: Math.round(plannedPayment * exactMonths - balance),
  };
}
