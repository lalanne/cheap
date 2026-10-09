// Spec 002's 2026-10-08 amendment (issue #12) — a date field's displayed
// value, built from the Date object's own local getters. Shared by both
// DatePickerField variants so the fix exists in exactly one place: the
// original bug was this same formatting logic, written twice, with
// `date.toISOString().slice(0, 10)` (UTC) in each — for a negative UTC
// offset (e.g. Chile, UTC-3/-4), that rolls the displayed date into the
// next calendar day for roughly the second half of every day, any local
// time where UTC has already crossed midnight.
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
