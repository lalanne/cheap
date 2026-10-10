export type MonthRef = { year: number; month: number }; // month is 1-indexed

// Exclusive upper bound of a calendar month (local time, spec 000's rigid
// calendar month): anything dated before this is "on or before the last
// day of the month". Spec 009's 2026-10-10 amendment.
export function startOfNextMonth({ year, month }: MonthRef): Date {
  return new Date(year, month, 1);
}
