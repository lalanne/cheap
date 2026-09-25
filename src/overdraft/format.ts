const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Whole CLP with '.' thousands separators — the same convention as every
// other screen (each keeps its own private copy; this one is shared by the
// overdraft banner and screen).
export function formatCLP(amount: number): string {
  return `$${Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Local date parts, not toISOString() (UTC) — see TransactionsScreen.
export function formatShortDate(date: Date): string {
  return `${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
