type ValidationResult = { ok: true; value: number } | { ok: false; error: string };

const DIGITS_ONLY = /^\d+$/;

export function validateAmount(raw: string): ValidationResult {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { ok: false, error: 'Enter an amount.' };
  }

  if (!DIGITS_ONLY.test(trimmed)) {
    return { ok: false, error: 'Enter a whole number in pesos — no decimals or symbols.' };
  }

  const value = Number(trimmed);

  if (value <= 0) {
    return { ok: false, error: 'Amount must be greater than zero.' };
  }

  return { ok: true, value };
}
