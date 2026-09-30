export type CreditCard = {
  id: string;
  name: string; // e.g. "Visa CLP" — shown wherever the card is picked
  limit: number; // whole CLP, approved credit limit
  minimumPayment: number; // whole CLP, statement minimum — also the
  // assumed monthly payment in the payoff estimate
  monthlyRate: number | null; // % per month on the carried balance; null =
  // unknown (spec 012's convention — not the same as a real 0%)
  createdAt: Date;
  updatedAt: Date;
};

export type NewCreditCardInput = {
  name: string;
  limit: number;
  minimumPayment: number;
  monthlyRate?: number | null;
};

export type CreditCardPatch = {
  name?: string;
  limit?: number;
  minimumPayment?: number;
  monthlyRate?: number | null;
};

export type LogCardPaymentInput = {
  cardId: string;
  amount: number;
  date: Date;
  note?: string | null;
};

/** users/{uid}/creditCardPayments — the only new ledger this spec needs.
 * A purchase is never written here: it's an ordinary `expense` transaction
 * (spec 002's 2026-09-29 amendment) tagged with `cardId`, so a card's
 * balance is a live sum over `transactions`, not a duplicated figure (see
 * spec 013, "Why not a separate ledger"). */
export type CreditCardPayment = {
  id: string;
  cardId: string;
  amount: number; // whole CLP, always > 0
  date: Date;
  note: string | null;
  createdAt: Date;
};

export interface CreditCardRepository {
  subscribe(callback: (cards: CreditCard[]) => void): () => void;
  create(input: NewCreditCardInput): Promise<CreditCard>;
  update(id: string, patch: CreditCardPatch): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface CreditCardPaymentRepository {
  subscribe(callback: (payments: CreditCardPayment[]) => void): () => void;
  logPayment(input: LogCardPaymentInput): Promise<void>;
  deletePayment(id: string): Promise<void>;
}
