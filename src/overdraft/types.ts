export type OverdraftEventType = 'draw' | 'payment' | 'interest' | 'fee';

// Interest and fees are real spending and get a linked expense; a draw or a
// payment of principal never does (spec 012, "Money rules").
export type OverdraftChargeType = 'interest' | 'fee';

export const OVERDRAFT_CHARGES_CATEGORY = 'Overdraft interest & fees';

/** users/{uid}/overdraft/line — the singleton settings doc. */
export type OverdraftLine = {
  limit: number; // whole CLP, approved line size
  monthlyRate: number; // % per month on the used balance, e.g. 1.9
  plannedMonthlyPayment: number | null; // whole CLP, drives the payoff estimate
  createdAt: Date;
  updatedAt: Date;
};

/** users/{uid}/overdraftEvents/{id} — the ledger. The balance is derived
 * from these, never stored (see overdraftMath.balanceOf). */
export type OverdraftEvent = {
  id: string;
  type: OverdraftEventType;
  amount: number; // whole CLP, always > 0
  date: Date;
  note: string | null;
  transactionId: string | null; // set for interest/fee: the linked expense
  createdAt: Date;
};

export type NewOverdraftLineInput = {
  limit: number;
  monthlyRate: number;
  plannedMonthlyPayment?: number | null;
  // Debt already on the line at first use, entered as an "Opening balance" draw.
  openingBalance?: number | null;
  openingDate?: Date;
};

export type OverdraftLinePatch = {
  limit?: number;
  monthlyRate?: number;
  plannedMonthlyPayment?: number | null;
};

export type LogMovementInput = {
  amount: number;
  date: Date;
  note?: string | null;
};

/** Two subscriptions, one per collection. `logCharge` and `deleteEvent`
 * are the atomic cross-collection writes (spec 012 criterion 6): an
 * interest/fee event and its linked expense transaction succeed or fail
 * together, same pattern as spec 008's `logPayment`. */
export interface OverdraftRepository {
  subscribeLine(callback: (line: OverdraftLine | null) => void): () => void;
  subscribeEvents(callback: (events: OverdraftEvent[]) => void): () => void;
  saveLine(input: NewOverdraftLineInput): Promise<void>;
  updateLine(patch: OverdraftLinePatch): Promise<void>;
  logDraw(input: LogMovementInput): Promise<void>;
  logPayment(input: LogMovementInput): Promise<void>;
  logCharge(type: OverdraftChargeType, input: LogMovementInput): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
