// Spec 008 — deliberately simple: balance / minimum payment, no
// amortization or interest compounding. See the spec's Requirements
// section for why.
export function monthsToPayoff(currentBalance: number, minimumPayment: number): number {
  if (currentBalance <= 0) {
    return 0;
  }
  if (minimumPayment <= 0) {
    return Infinity;
  }
  return Math.ceil(currentBalance / minimumPayment);
}

export function percentPaid(originalAmount: number, currentBalance: number): number {
  if (originalAmount <= 0) {
    return 0;
  }
  if (currentBalance <= 0) {
    return 1;
  }
  return (originalAmount - currentBalance) / originalAmount;
}
