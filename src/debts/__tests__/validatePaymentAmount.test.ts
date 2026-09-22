import { validatePaymentAmount } from '../validatePaymentAmount';

describe('validatePaymentAmount (spec 008 criterion 5)', () => {
  it('accepts a valid payment within the current balance', () => {
    expect(validatePaymentAmount('50000', 1200000)).toEqual({ ok: true, value: 50000 });
  });

  it('rejects a blank amount', () => {
    expect(validatePaymentAmount('', 1200000).ok).toBe(false);
  });

  it('rejects zero or negative amounts', () => {
    expect(validatePaymentAmount('0', 1200000).ok).toBe(false);
    expect(validatePaymentAmount('-1000', 1200000).ok).toBe(false);
  });

  it('rejects a non-integer amount', () => {
    expect(validatePaymentAmount('1500.50', 1200000).ok).toBe(false);
  });

  it('rejects an amount greater than the current balance', () => {
    const result = validatePaymentAmount('1200001', 1200000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/balance/i);
    }
  });

  it('accepts an amount exactly equal to the current balance (pays it off)', () => {
    expect(validatePaymentAmount('1200000', 1200000)).toEqual({ ok: true, value: 1200000 });
  });
});
