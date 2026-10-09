import { formatLocalDate } from '../formatLocalDate';

// Spec 002's 2026-10-08 amendment (issue #12) — the bug this guards
// against only shows up for a negative UTC offset, late enough in the
// local day that UTC has already crossed midnight. Pinning TZ here means
// this test fails the same way regardless of which timezone the machine
// (or CI runner, which defaults to UTC) actually runs in.
const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Santiago'; // Chile, UTC-3/-4
});

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('formatLocalDate', () => {
  it('formats using local date parts, not UTC — the exact bug from issue #12', () => {
    // 6 October, 22:00 local (America/Santiago). toISOString() rolls this
    // to "2026-10-07" (UTC); the fix must not.
    const evening = new Date(2026, 9, 6, 22, 0);

    expect(formatLocalDate(evening)).toBe('2026-10-06');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 22, 0))).toBe('2026-01-05');
  });

  it('is unaffected for a time of day that does not cross the UTC boundary', () => {
    const morning = new Date(2026, 9, 6, 8, 0);

    expect(formatLocalDate(morning)).toBe('2026-10-06');
  });

  it('handles the turn of a year correctly', () => {
    const newYearsEve = new Date(2026, 11, 31, 22, 0);

    expect(formatLocalDate(newYearsEve)).toBe('2026-12-31');
  });
});
