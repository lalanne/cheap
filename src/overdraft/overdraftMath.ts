import { startOfNextMonth, type MonthRef } from '../dashboard/monthBounds';
import type { OverdraftEvent } from './types';

// Spec 012 — pure derivations over the event ledger. Nothing here is stored.

const HIGH_NUMERATOR = 3; // 75% = 3/4, compared in integers to keep the
const HIGH_DENOMINATOR = 4; // boundary exact (no float drift at 1.500.000).

export type OverdraftStatus = 'unused' | 'in-use' | 'high' | 'over-limit';

function signed(event: OverdraftEvent): number {
  return event.type === 'payment' ? -event.amount : event.amount;
}

// Date order, ties broken by when the event was logged.
function replayOrder(events: OverdraftEvent[]): OverdraftEvent[] {
  return [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function balanceOf(events: OverdraftEvent[]): number {
  return events.reduce((sum, e) => sum + signed(e), 0);
}

// Spec 012 criterion 25 — ledger balance at the end of `month`; `null` when
// no event is dated on or before it (the line wasn't in use yet).
export function balanceAsOf(events: OverdraftEvent[], month: MonthRef): number | null {
  const end = startOfNextMonth(month);
  const upTo = events.filter((e) => e.date < end);
  return upTo.length === 0 ? null : balanceOf(upTo);
}

export function availableOf(balance: number, limit: number): number {
  return limit - balance;
}

export function usedPercent(balance: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  return Math.round((balance / limit) * 100);
}

export function overdraftStatus(balance: number, limit: number): OverdraftStatus {
  if (balance <= 0) {
    return 'unused';
  }
  if (balance > limit) {
    return 'over-limit';
  }
  if (balance * HIGH_DENOMINATOR >= limit * HIGH_NUMERATOR) {
    return 'high';
  }
  return 'in-use';
}

type Run = { since: Date | null; peak: number };

// Replays the ledger, tracking the current continuous use: it starts when
// the balance rises from 0 and ends (forgetting its peak) when it returns to 0.
function currentRun(events: OverdraftEvent[]): Run {
  let balance = 0;
  let run: Run = { since: null, peak: 0 };
  for (const e of replayOrder(events)) {
    const before = balance;
    balance += signed(e);
    if (balance <= 0) {
      run = { since: null, peak: 0 };
    } else {
      if (before <= 0) {
        run = { since: e.date, peak: 0 };
      }
      run.peak = Math.max(run.peak, balance);
    }
  }
  return run;
}

export function inUseSince(events: OverdraftEvent[]): Date | null {
  return currentRun(events).since;
}

export function peakBalanceSinceInUse(events: OverdraftEvent[]): number {
  return currentRun(events).peak;
}

export function percentCleared(balance: number, peak: number): number {
  if (balance <= 0 || peak <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, 1 - balance / peak));
}

export type CostSummary = { interestThisMonth: number; feesThisMonth: number; totalCost: number };

export function costSummary(events: OverdraftEvent[], now: Date): CostSummary {
  let interestThisMonth = 0;
  let feesThisMonth = 0;
  let totalCost = 0;
  for (const e of events) {
    if (e.type !== 'interest' && e.type !== 'fee') {
      continue;
    }
    totalCost += e.amount;
    const thisMonth =
      e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
    if (thisMonth) {
      if (e.type === 'interest') {
        interestThisMonth += e.amount;
      } else {
        feesThisMonth += e.amount;
      }
    }
  }
  return { interestThisMonth, feesThisMonth, totalCost };
}

// Spec 013's 2026-09-29 extraction: this math is identical for any
// revolving balance (the overdraft, or a credit card), so it now lives in
// one shared module both features import — re-exported here under this
// spec's own names so nothing else in this file (or its callers) changes.
export { projectedMonthlyInterest } from '../finance/revolvingPayoff';
export { revolvingPayoff as overdraftPayoff } from '../finance/revolvingPayoff';
export type { RevolvingPayoff as OverdraftPayoff } from '../finance/revolvingPayoff';

export type UsageTransition = 'started' | 'crossed-high' | 'crossed-limit';

// Which confirmation a balance increase earns; the most severe threshold
// crossed wins when one draw crosses several.
export function usageTransition(
  before: number,
  after: number,
  limit: number,
): UsageTransition | null {
  if (after <= before) {
    return null;
  }
  if (before <= limit && after > limit) {
    return 'crossed-limit';
  }
  const wasBelowHigh = before * HIGH_DENOMINATOR < limit * HIGH_NUMERATOR;
  const isAtLeastHigh = after * HIGH_DENOMINATOR >= limit * HIGH_NUMERATOR;
  if (wasBelowHigh && isAtLeastHigh && after <= limit) {
    return 'crossed-high';
  }
  if (before <= 0 && after > 0 && after <= limit) {
    return 'started';
  }
  return null;
}

export type HistoryPoint = { year: number; month: number; balance: number };

// The balance at the end of each of the last `months` calendar months, oldest
// first; the current month runs up to `now`, and later events are ignored.
export function balanceHistory(events: OverdraftEvent[], now: Date, months = 6): HistoryPoint[] {
  const ordered = replayOrder(events).filter((e) => e.date.getTime() <= now.getTime());
  const points: HistoryPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const balance = balanceOf(ordered.filter((e) => e.date.getTime() < nextMonthStart.getTime()));
    points.push({ year: monthStart.getFullYear(), month: monthStart.getMonth() + 1, balance });
  }
  return points;
}
