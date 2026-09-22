import { validateAmount } from '../transactions/validateAmount';

type ValidationResult = { ok: true; value: number } | { ok: false; error: string };

// Reuses validateAmount's zero/negative/non-integer checks, then adds the
// payment-specific rule (spec 008 criterion 5): a payment can't exceed
// the debt's current balance.
export function validatePaymentAmount(raw: string, currentBalance: number): ValidationResult {
  const base = validateAmount(raw);
  if (!base.ok) {
    return base;
  }
  if (base.value > currentBalance) {
    return { ok: false, error: 'Payment can’t be more than the current balance.' };
  }
  return base;
}
