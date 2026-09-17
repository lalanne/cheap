import { validateAmount } from '../validateAmount';

describe('validateAmount', () => {
  it('accepts a whole positive number', () => {
    expect(validateAmount('45000')).toEqual({ ok: true, value: 45000 });
  });

  it('rejects a blank amount', () => {
    expect(validateAmount('')).toEqual({ ok: false, error: 'Enter an amount.' });
    expect(validateAmount('   ')).toEqual({ ok: false, error: 'Enter an amount.' });
  });

  it('rejects zero', () => {
    expect(validateAmount('0')).toEqual({
      ok: false,
      error: 'Amount must be greater than zero.',
    });
  });

  it('rejects a negative amount', () => {
    expect(validateAmount('-100')).toEqual({
      ok: false,
      error: 'Enter a whole number in pesos — no decimals or symbols.',
    });
  });

  it('rejects decimal digits (criterion 2 — CLP has no minor unit)', () => {
    expect(validateAmount('1500.50')).toEqual({
      ok: false,
      error: 'Enter a whole number in pesos — no decimals or symbols.',
    });
    expect(validateAmount('1500,50')).toEqual({
      ok: false,
      error: 'Enter a whole number in pesos — no decimals or symbols.',
    });
  });

  it('rejects non-numeric input', () => {
    expect(validateAmount('abc')).toEqual({
      ok: false,
      error: 'Enter a whole number in pesos — no decimals or symbols.',
    });
  });

  it('rejects a thousands-separated amount as ambiguous rather than guessing', () => {
    // "1.500" could mean 1,500 or 1.5 depending on convention — reject
    // rather than silently pick one. The input field takes plain digits.
    expect(validateAmount('45.000')).toEqual({
      ok: false,
      error: 'Enter a whole number in pesos — no decimals or symbols.',
    });
  });
});
