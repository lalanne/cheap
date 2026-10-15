import type { Budget } from '../budgets/types';
import type { Category } from '../transactions/types';

export type GaugeSegment = {
  category: string;
  color: string;
  limit: number;
  spent: number;
  arcLength: number;
  arcOffset: number;
  fillRatio: number;
  fillLength: number;
  over: boolean;
};

export type GaugeResult = {
  segments: GaugeSegment[];
  totalBudgeted: number;
  totalSpent: number;
  unbudgeted: number;
};

// Spec 009 2026-10-15 amendment (#36), criteria 24-27. Skeleton only: the
// failing tests in __tests__/gaugeSegments.test.ts drive the real
// implementation.
export function computeGaugeSegments(_input: {
  budgets: Budget[];
  categories: Category[];
  totals: Record<string, number>;
  radius: number;
}): GaugeResult {
  throw new Error('not implemented');
}

export function rankGaugeRows(_segments: GaugeSegment[]): GaugeSegment[] {
  throw new Error('not implemented');
}
